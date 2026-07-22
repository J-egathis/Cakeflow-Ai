const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cakeflow:cakeflow123@cluster0.g4typp0.mongodb.net/cakeflow?retryWrites=true&w=majority';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, default: '' },
  ingredients: { type: String, default: '' },
  price: { type: Number, required: true },
  image: { type: String },
  estimatedPrepTime: { type: Number, default: 15 },
  isBestseller: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },
  isChefRecommended: { type: Boolean, default: false },
  isOffer: { type: Boolean, default: false },
  discountPrice: { type: Number, default: 0 },
  inStock: { type: Boolean, default: true }
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const newProducts = [
  // 1. Birthday Cakes (4)
  {
    name: 'Midnight Chocolate Truffle Cake',
    category: 'Birthday Cakes',
    description: 'Decadent 3-layer dark chocolate sponge layered with rich Belgian ganache and chocolate shavings.',
    ingredients: 'Dark Chocolate, Belgian Cocoa, Cream, Butter, Flour, Eggs, Sugar',
    price: 850,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 30,
    isBestseller: true,
    isTrending: true,
    inStock: true
  },
  {
    name: 'Classic Red Velvet Cake',
    category: 'Birthday Cakes',
    description: 'Moist crimson velvet sponge layered with silky cream cheese frosting and white chocolate curls.',
    ingredients: 'Cocoa, Buttermilk, Cream Cheese, Vanilla, Flour, Eggs',
    price: 900,
    image: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 25,
    isOffer: true,
    discountPrice: 799,
    inStock: true
  },
  {
    name: 'Fresh Mango Vanilla Sponge Cake',
    category: 'Birthday Cakes',
    description: 'Light vanilla sponge soaked in Alphonso mango nectar, layered with whipped cream and fresh mango slices.',
    ingredients: 'Alphonso Mangoes, Vanilla Sponge, Heavy Cream, Sugar',
    price: 750,
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 20,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Black Forest Gateau Special',
    category: 'Birthday Cakes',
    description: 'Traditional German chocolate sponge layered with sour cherries, kirsch cream, and chocolate flakes.',
    ingredients: 'Chocolate, Cherries, Kirsch Cream, Vanilla, Flour',
    price: 800,
    image: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 25,
    isChefRecommended: true,
    inStock: true
  },

  // 2. Wedding Cakes (4)
  {
    name: 'Golden Lace Elegant 3-Tier',
    category: 'Wedding Cakes',
    description: 'Magnificent 3-tier grand wedding cake adorned with edible gold leaf, white sugar roses, and champagne cream.',
    ingredients: 'Champagne Cream, White Fondant, Almond Sponge, Edible Gold Leaf',
    price: 4500,
    image: 'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 120,
    isChefRecommended: true,
    inStock: true
  },
  {
    name: 'Floral White Fondant Tiered Cake',
    category: 'Wedding Cakes',
    description: 'Exquisite 2-tier white fondant cake decorated with handcrafted sugar blossom orchids and hazelnut praline.',
    ingredients: 'Hazelnut Praline, Vanilla Bean, White Chocolate Ganache, Fondant',
    price: 3800,
    image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 90,
    inStock: true
  },
  {
    name: 'Royal Velvet Pearl Wedding Cake',
    category: 'Wedding Cakes',
    description: 'Luxurious red velvet and white chocolate tier decorated with sugar pearls and silver accents.',
    ingredients: 'Red Velvet Sponge, White Ganache, Edible Pearls, Cream Cheese',
    price: 4200,
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 100,
    isTrending: true,
    inStock: true
  },
  {
    name: 'Rustic Berry Naked Wedding Cake',
    category: 'Wedding Cakes',
    description: 'Charming semi-naked sponge layered with fresh raspberries, blueberries, strawberries, and vanilla bean cream.',
    ingredients: 'Fresh Berries, Vanilla Bean Mousse, Buttercream, Honey Sponge',
    price: 3500,
    image: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 80,
    isBestseller: true,
    inStock: true
  },

  // 3. Cup Cakes (4)
  {
    name: 'Belgian Choco Lava Cupcake',
    category: 'Cup Cakes',
    description: 'Rich dark chocolate cupcake filled with warm molten Belgian fudge center and chocolate frosting.',
    ingredients: 'Belgian Cocoa, Warm Fudge, Cream, Butter, Flour',
    price: 120,
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 10,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Strawberry Dream Cupcake',
    category: 'Cup Cakes',
    description: 'Fluffy strawberry sponge topped with fresh strawberry puree buttercream and rainbow sprinkles.',
    ingredients: 'Strawberry Puree, Vanilla Buttercream, Flour, Eggs',
    price: 95,
    image: 'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 8,
    inStock: true
  },
  {
    name: 'Salted Caramel Crunch Cupcake',
    category: 'Cup Cakes',
    description: 'Moist caramel sponge filled with gooey salted caramel and topped with toasted sea salt pretzel crunch.',
    ingredients: 'Salted Caramel, Pretzels, Buttercream, Toffee Bits',
    price: 110,
    image: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 10,
    isOffer: true,
    discountPrice: 90,
    inStock: true
  },
  {
    name: 'Blueberry Vanilla Muffin Cupcake',
    category: 'Cup Cakes',
    description: 'Classic vanilla cake bursting with wild blueberries and topped with a light cream cheese swirl.',
    ingredients: 'Wild Blueberries, Cream Cheese, Vanilla Sponge, Lemon Zest',
    price: 105,
    image: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 8,
    isTrending: true,
    inStock: true
  },

  // 4. Pastries (4)
  {
    name: 'Blueberry Glazed Cheesecake Pastry',
    category: 'Pastries',
    description: 'Creamy New York style cheesecake slice topped with sweet blueberry glaze on a graham cracker crust.',
    ingredients: 'Cream Cheese, Blueberries, Graham Cracker, Butter',
    price: 180,
    image: 'https://images.unsplash.com/photo-1524351199679-46cddf530c04?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Dutch Dark Chocolate Slice',
    category: 'Pastries',
    description: 'Intense 70% Dutch dark chocolate layer pastry topped with cocoa powder and dark chocolate leaf.',
    ingredients: '70% Dark Chocolate, Cocoa Powder, Heavy Cream, Flour',
    price: 160,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isTrending: true,
    inStock: true
  },
  {
    name: 'Pineapple Cream Delight Pastry',
    category: 'Pastries',
    description: 'Refreshingly light vanilla sponge layered with tropical pineapple chunks and fresh whipped cream.',
    ingredients: 'Pineapple, Whipped Cream, Vanilla Sponge, Maraschino Cherry',
    price: 140,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  {
    name: 'Tiramisu Espresso Slice',
    category: 'Pastries',
    description: 'Italian ladyfinger biscuit soaked in dark espresso roast layered with mascarpone mousse and dusting of cocoa.',
    ingredients: 'Mascarpone, Espresso, Ladyfingers, Cocoa Powder',
    price: 190,
    image: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isChefRecommended: true,
    inStock: true
  },

  // 5. Brownies (4)
  {
    name: 'Fudge Walnut Brownie with Hot Fudge',
    category: 'Brownies',
    description: 'Fudgey chewy dark chocolate brownie loaded with crunchy roasted walnuts and drizzled with warm cocoa sauce.',
    ingredients: 'Walnuts, Dark Fudge, Cocoa, Butter, Flour, Eggs',
    price: 220,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 12,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Sizzling S’mores Chocolate Brownie',
    category: 'Brownies',
    description: 'Warm brownie base topped with toasted marshmallows, graham cracker crumble, and chocolate fudge.',
    ingredients: 'Marshmallows, Graham Crackers, Chocolate Fudge, Cocoa',
    price: 240,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 15,
    isTrending: true,
    inStock: true
  },
  {
    name: 'Nutella Overload Loaded Brownie',
    category: 'Brownies',
    description: 'Rich chocolate brownie generously swirled with hazelnut Nutella spread and crushed Ferrero Rocher.',
    ingredients: 'Nutella, Ferrero Rocher, Cocoa, Butter, Hazelnut',
    price: 250,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 12,
    isChefRecommended: true,
    inStock: true
  },
  {
    name: 'Triple Choco Melt Brownie',
    category: 'Brownies',
    description: 'Ultimate triple chocolate brownie featuring milk chocolate, dark chocolate, and white chocolate chips.',
    ingredients: 'Milk Chocolate, Dark Chocolate, White Chocolate Chips',
    price: 210,
    image: 'https://images.unsplash.com/photo-1511018556340-d16986a1c194?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 10,
    isOffer: true,
    discountPrice: 180,
    inStock: true
  },

  // 6. Cookies (4)
  {
    name: 'Double Chocolate Chunk Cookie',
    category: 'Cookies',
    description: 'Crisp on the outside, gooey on the inside dark cocoa cookie packed with melt-in-your-mouth chocolate chunks.',
    ingredients: 'Dark Chocolate Chunks, Cocoa, Butter, Brown Sugar, Flour',
    price: 80,
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Peanut Butter Oatmeal Cookie',
    category: 'Cookies',
    description: 'Hearty whole grain rolled oats cookie baked with creamy peanut butter and honey.',
    ingredients: 'Rolled Oats, Creamy Peanut Butter, Honey, Cinnamon',
    price: 75,
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  {
    name: 'Butter Shortbread Choco Cookie',
    category: 'Cookies',
    description: 'Melt-in-mouth Scottish shortbread cookie infused with pure Danish butter and dipped in dark chocolate.',
    ingredients: 'Danish Butter, Milk Chocolate, Sea Salt, Sugar, Flour',
    price: 70,
    image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  {
    name: 'White Choco Macadamia Nut Cookie',
    category: 'Cookies',
    description: 'Gourmet golden cookie loaded with Belgian white chocolate chips and toasted Hawaiian macadamia nuts.',
    ingredients: 'Macadamia Nuts, White Chocolate Chips, Butter, Vanilla',
    price: 90,
    image: 'https://images.unsplash.com/photo-1548365328-8c6db4b63391?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isTrending: true,
    inStock: true
  },

  // 7. Veg Snacks (4)
  {
    name: 'Paneer Tikka Gourmet Puff',
    category: 'Veg Snacks',
    description: 'Golden flaky puff pastry stuffed with spicy tandoori marinated cottage cheese and bell peppers.',
    ingredients: 'Paneer Cottage Cheese, Tandoori Masala, Bell Peppers, Flaky Pastry',
    price: 110,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 15,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Cheesy Garlic Breadsticks',
    category: 'Veg Snacks',
    description: 'Warm herb infused breadsticks baked with garlic butter, mozzarella, and sprinkled with oregano.',
    ingredients: 'Mozzarella Cheese, Garlic Butter, Oregano, Yeast Dough',
    price: 150,
    image: 'https://images.unsplash.com/photo-1574085733277-851d9d856a3a?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 12,
    inStock: true
  },
  {
    name: 'Veg Crispy Spring Rolls',
    category: 'Veg Snacks',
    description: 'Crispy fried rolls filled with seasoned shredded cabbage, carrots, capsicum, and sweet chili sauce.',
    ingredients: 'Cabbage, Carrots, Capsicum, Spring Roll Wrappers, Sweet Chili',
    price: 130,
    image: 'https://images.unsplash.com/photo-1544025162-811114215b3a?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 10,
    inStock: true
  },
  {
    name: 'Cheese Burst Pizza Slice',
    category: 'Veg Snacks',
    description: 'Generous slice of sourdough pizza loaded with double mozzarella cheese, sweet corn, and Italian herbs.',
    ingredients: 'Mozzarella, Sourdough Dough, Sweet Corn, Tomato Sauce, Herbs',
    price: 180,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 15,
    isChefRecommended: true,
    inStock: true
  },

  // 8. Non-Veg Snacks (4)
  {
    name: 'Spicy Crispy Chicken Burger',
    category: 'Non-Veg Snacks',
    description: 'Juicy crispy fried chicken breast fillet in a brioche bun with fiery mayo, lettuce, and jalapeños.',
    ingredients: 'Chicken Fillet, Brioche Bun, Fiery Mayo, Lettuce, Jalapeños',
    price: 240,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 18,
    isBestseller: true,
    isTrending: true,
    inStock: true
  },
  {
    name: 'Peri Peri Chicken Wings (6pcs)',
    category: 'Non-Veg Snacks',
    description: 'Crispy fried jumbo chicken wings tossed in spicy African Peri Peri chili rub.',
    ingredients: 'Chicken Wings, Peri Peri Chili Sauce, Garlic Powder, Spices',
    price: 260,
    image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 15,
    isOffer: true,
    discountPrice: 220,
    inStock: true
  },
  {
    name: 'Grilled Chicken Club Sandwich',
    category: 'Non-Veg Snacks',
    description: 'Triple-decker toasted bread filled with herb grilled chicken strips, fried egg, cheese, and tomatoes.',
    ingredients: 'Grilled Chicken, Toast Bread, Fried Egg, Cheddar Cheese',
    price: 210,
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 12,
    inStock: true
  },
  {
    name: 'Chicken Golden Nuggets (8pcs)',
    category: 'Non-Veg Snacks',
    description: 'Tender chicken breast nuggets coated in crunchy breadcrumbs served with barbecue dipping sauce.',
    ingredients: 'Chicken Breast, Breadcrumbs, Barbecue Dip, Spices',
    price: 190,
    image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 10,
    inStock: true
  },

  // 9. Cold Drinks (4)
  {
    name: 'Sparkling Mint Mojito',
    category: 'Cold Drinks',
    description: 'Ultra refreshing mocktail made with crushed fresh mint leaves, lime juice, cane sugar, and sparkling soda.',
    ingredients: 'Fresh Mint, Lime Juice, Sparkling Soda, Crushed Ice, Sugar',
    price: 140,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Classic Choco Cold Coffee',
    category: 'Cold Drinks',
    description: 'Rich blended espresso roast with chilled whole milk, Hershey chocolate syrup, and vanilla ice cream scoop.',
    ingredients: 'Espresso Roast, Milk, Chocolate Syrup, Vanilla Ice Cream',
    price: 150,
    image: 'https://images.unsplash.com/photo-1461023058943-0708e5223eeb?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isOffer: true,
    discountPrice: 120,
    inStock: true
  },
  {
    name: 'Iced Peach Lemon Tea',
    category: 'Cold Drinks',
    description: 'Steeped Ceylon black tea infused with sweet peach nectar and tangy Meyer lemon slices.',
    ingredients: 'Ceylon Black Tea, Peach Nectar, Lemon Slices, Ice',
    price: 130,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  {
    name: 'Blue Ocean Cooler',
    category: 'Cold Drinks',
    description: 'Vibrant blue curacao syrup mocktail with lemon splash, crushed ice, and sprite.',
    ingredients: 'Blue Curacao, Sprite, Lemon Juice, Mint Leaves',
    price: 145,
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isTrending: true,
    inStock: true
  },

  // 10. Hot Drinks (4)
  {
    name: 'Hazelnut Latte Macchiato',
    category: 'Hot Drinks',
    description: 'Smooth double shot espresso poured over steamed whole milk and French hazelnut syrup.',
    ingredients: 'Double Shot Espresso, Steamed Milk, Hazelnut Syrup, Cocoa Dusting',
    price: 190,
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Dark Hot Chocolate with Marshmallows',
    category: 'Hot Drinks',
    description: 'Rich Dutch dark cocoa simmered with full cream milk and topped with fluffy toasted marshmallows.',
    ingredients: 'Dutch Cocoa, Cream Milk, Toasted Marshmallows',
    price: 180,
    image: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isChefRecommended: true,
    inStock: true
  },
  {
    name: 'Masala Cardamom Chai',
    category: 'Hot Drinks',
    description: 'Authentic Indian milk tea brewed with fresh green cardamom, ginger, cloves, and Assam black tea.',
    ingredients: 'Assam Tea, Cardamom, Fresh Ginger, Whole Milk, Sugar',
    price: 60,
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  {
    name: 'Cappuccino Espresso Roast',
    category: 'Hot Drinks',
    description: 'Classic Italian cappuccino with equal parts espresso roast, steamed milk, and thick velvety milk foam.',
    ingredients: 'Espresso Beans, Steamed Milk, Cinnamon Powder',
    price: 170,
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },

  // 11. Fresh Juice (4)
  {
    name: 'Fresh Watermelon Mint Juice',
    category: 'Fresh Juice',
    description: '100% natural cold-pressed watermelon juice with a splash of fresh mint and rock salt.',
    ingredients: 'Cold Pressed Watermelon, Mint, Rock Salt, Ice',
    price: 120,
    image: 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Mango Tango Smoothie',
    category: 'Fresh Juice',
    description: 'Thick tropical smoothie made with ripe Alphonso mangoes, Greek yogurt, and honey.',
    ingredients: 'Alphonso Mango, Greek Yogurt, Honey, Milk',
    price: 160,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da9319?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 8,
    isTrending: true,
    inStock: true
  },
  {
    name: 'Orange Vitamin Boost Juice',
    category: 'Fresh Juice',
    description: 'Freshly squeezed Nagpur oranges packed with Vitamin C and natural citrus flavor.',
    ingredients: 'Fresh Pressed Oranges, Ice',
    price: 130,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  {
    name: 'Strawberry Banana Shake',
    category: 'Fresh Juice',
    description: 'Creamy blend of fresh Mahabaleshwar strawberries, ripe bananas, and chilled milk.',
    ingredients: 'Fresh Strawberries, Bananas, Milk, Honey',
    price: 170,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da9319?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 8,
    isOffer: true,
    discountPrice: 140,
    inStock: true
  },

  // 12. Spicy Chats (4)
  {
    name: 'Paani Puri Crisp Splash (8pcs)',
    category: 'Spicy Chats',
    description: 'Crispy hollow puris served with spicy mint coriander paani, sweet tamarind chutney, and boiled potato mash.',
    ingredients: 'Semolina Puris, Spicy Mint Water, Tamarind Chutney, Boiled Potatoes',
    price: 80,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Crunchy Bhel Puri Mix',
    category: 'Spicy Chats',
    description: 'Tangy Indian street snack made of puffed rice, crispy sev, diced onions, tomatoes, and spicy chutneys.',
    ingredients: 'Puffed Rice, Sev, Tamarind & Green Chutneys, Tomatoes, Onions',
    price: 90,
    image: 'https://images.unsplash.com/photo-1599487405270-450520098f59?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  {
    name: 'Crispy Aloo Tikki Chat',
    category: 'Spicy Chats',
    description: 'Pan-fried golden potato patties topped with spicy chickpea ragda, curd, chutneys, and fresh coriander.',
    ingredients: 'Potato Patties, White Chickpea Curry, Curd, Tamarind Chutney',
    price: 100,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 10,
    inStock: true
  },
  {
    name: 'Samosa Matar Chat',
    category: 'Spicy Chats',
    description: 'Crushed potato samosas smothered in spiced yellow peas gravy, curd, onions, and crunchy nylon sev.',
    ingredients: 'Potato Samosas, Spiced Yellow Peas, Nylon Sev, Curd, Chutney',
    price: 110,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 8,
    isTrending: true,
    inStock: true
  },

  // 13. Sweet Chats (4)
  {
    name: 'Dahi Papdi Chat',
    category: 'Sweet Chats',
    description: 'Crispy fried dough wafers topped with sweet creamy yogurt, sweet date-tamarind chutney, and pomegranate seeds.',
    ingredients: 'Crispy Papdi Wafers, Sweet Chilled Curd, Tamarind Chutney, Pomegranate',
    price: 110,
    image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 8,
    isChefRecommended: true,
    inStock: true
  },
  {
    name: 'Royal Raj Kachori',
    category: 'Sweet Chats',
    description: 'Grand jumbo crisp kachori shell filled with lentil dumplings, sweet curd, chutneys, pomegranates, and sev.',
    ingredients: 'Crispy Kachori Shell, Bhalla Dumplings, Sweet Yogurt, Sev, Spices',
    price: 140,
    image: 'https://images.unsplash.com/photo-1626804475297-41609ea004eb?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 12,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Sweet Dahi Puri (6pcs)',
    category: 'Sweet Chats',
    description: 'Hollow crisp puris stuffed with boiled potato mash, overflowing with sweet sweetened yogurt and tamarind glaze.',
    ingredients: 'Puris, Sweet Chilled Curd, Date Tamarind Glaze, Potato, Sev',
    price: 100,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 6,
    inStock: true
  },
  {
    name: 'Gulab Jamun Chat Bowl',
    category: 'Sweet Chats',
    description: 'Warm soft gulab jamuns served over chilled rabri cream with pistachio nuts and silver leaf.',
    ingredients: 'Gulab Jamuns, Thick Rabri Milk, Pistachio Nuts, Saffron',
    price: 120,
    image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isTrending: true,
    inStock: true
  }
];

async function updateDb() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');
    await Product.deleteMany({});
    console.log('Cleared old product list');
    const inserted = await Product.insertMany(newProducts);
    console.log(`Successfully seeded ${inserted.length} products (4+ per subcategory)!`);
  } catch (e) {
    console.error('Database update error:', e);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected DB');
  }
}

updateDb();
