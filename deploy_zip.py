import os
import zipfile

# Production settings live in .env.hostinger and are packed into the zip as ".env".
# The local .env (local MySQL) is never included, so no manual swapping is needed.
PROD_ENV_FILE = '.env.hostinger'

def create_deploy_zip(zip_filename):
    if not os.path.exists(PROD_ENV_FILE):
        raise SystemExit(f'ERROR: {PROD_ENV_FILE} not found. Create it with the Hostinger MySQL credentials first.')
    if not os.path.exists(os.path.join('client', 'dist', 'index.html')):
        raise SystemExit('ERROR: client/dist missing. Run "npm run build" inside client/ first.')

    print(f'Creating {zip_filename}...')
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Exclude unwanted directories
            dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.qodo', 'temp_deploy', 'temp_deploy_2', '__pycache__', 'uploads', 'venv', 'env']]
            
            # Exclude client/node_modules if it somehow is there
            if 'client' in root and 'node_modules' in dirs:
                dirs.remove('node_modules')

            for file in files:
                # Exclude python and js scripts in the root directory that are just tools, except server.js
                if root == '.':
                    if file.endswith(('.js', '.py', '.txt', '.zip', '.log')):
                        if file not in ['server.js', 'package.json', 'package-lock.json']:
                            continue
                    # Local / production env files are handled separately below
                    if file.startswith('.env'):
                        continue
                
                # Exclude the zip file itself and this script
                if file == zip_filename or file == 'deploy_zip.py':
                    continue
                
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, '.')
                zipf.write(file_path, rel_path)

        # Production env goes into the zip as .env
        zipf.write(PROD_ENV_FILE, '.env')
    
    print('Zip file created successfully!')

if __name__ == '__main__':
    create_deploy_zip('CakeFlow_Hostinger_Deploy.zip')
