# 🍰 CakeFlow AI

<div align="center">

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black)
![Status](https://img.shields.io/badge/Project-In%20Development-orange)

### Smart QR-Based Real-Time Cake & Snacks Restaurant Management System

A modern restaurant management platform that enables customers to order food by scanning a QR code assigned to their table. Orders are delivered instantly to the kitchen, while customers, waiters, chefs, and administrators receive live updates through a real-time dashboard.

</div>

---

# 📖 Overview

CakeFlow AI is a next-generation QR-based restaurant management system built for cake shops, cafés, bakeries, and snack restaurants. Every dining table has its own unique QR code that automatically identifies the table number. Customers simply scan the QR code using their smartphone, browse the digital menu, and place orders without waiting for a waiter.

Once an order is placed, it is instantly routed to the appropriate kitchen section using Socket.IO. Cake orders are sent to the cake preparation team, snack orders are sent to the snack kitchen, and every status update is synchronized in real time across the customer interface, kitchen dashboard, waiter panel, cashier system, and administrator dashboard.

The platform is designed with a modern 2026 UI/UX, responsive layouts, role-based authentication, and scalable architecture, making it suitable for real-world restaurant operations.

---

# ✨ Features

## 👨‍🍳 Customer

- Scan QR Code
- Automatic Table Detection
- Digital Menu
- Search Food
- Category Filter
- Add to Cart
- Place Order
- Live Order Tracking
- Order History
- Mobile Responsive

---

## 🎂 Cake Kitchen

- Receive Cake Orders
- Accept / Reject Orders
- Preparation Status
- Estimated Time
- Mark Ready
- Mark Delivered

---

## 🍟 Snacks Kitchen

- Receive Snack Orders
- Update Preparation Status
- Reject Unavailable Items
- Live Dashboard

---

## 🍽 Waiter Panel

- View Active Tables
- Order Status
- Ready Orders
- Serve Customer
- Close Table

---

## 💰 Cashier

- Generate Bill
- Payment Status
- UPI Payment
- Cash Payment
- Invoice Download

---

## 👨‍💼 Admin

- Dashboard
- Manage Menu
- Manage Tables
- Manage Users
- Manage Orders
- Sales Analytics
- Reports
- Inventory Management

---

# 🚀 Real-Time Workflow

```text
Customer

↓

Scan QR Code

↓

Digital Menu

↓

Place Order

↓

MongoDB

↓

Socket.IO

↓

Kitchen Dashboard

↓

Accept Order

↓

Preparing

↓

Ready

↓

Waiter

↓

Serve Customer

↓

Payment

↓

Dashboard Updated
```

---

# 📱 QR Code Ordering

Each table contains a unique QR Code.

Example

```
Table 1

https://cakeflow.vercel.app/table/1
```

```
Table 2

https://cakeflow.vercel.app/table/2
```

```
Table 3

https://cakeflow.vercel.app/table/3
```

Customer scans the QR code and the system automatically identifies the table number.

No login required.

---

# 🍰 Order Status

```
Pending

↓

Accepted

↓

Preparing

↓

Baking

↓

Decorating

↓

Ready

↓

Served
```

Every status updates instantly without refreshing the page.

---

# 👥 User Roles

| Role | Description |
|-------|-------------|
| Customer | Scan QR and Place Order |
| Cake Chef | Prepare Cake Orders |
| Snacks Chef | Prepare Snack Orders |
| Waiter | Serve Orders |
| Cashier | Billing & Payments |
| Admin | Complete System Management |

---

# 📊 Dashboard

- Today's Orders
- Revenue
- Pending Orders
- Completed Orders
- Active Tables
- Kitchen Performance
- Popular Items
- Best Selling Cake
- Best Selling Snack
- Live Activity Feed

---

# 🛠 Technology Stack

## Frontend

- React.js
- Next.js
- TypeScript
- Tailwind CSS
- Framer Motion
- Shadcn UI

---

## Backend

- Node.js
- Express.js

---

## Database

- MongoDB Atlas

---

## Authentication

- JWT
- bcrypt

---

## Real-Time

- Socket.IO

---

## Charts

- Chart.js
- Recharts

---

## Deployment

Frontend

- Vercel

Backend

- Render

Database

- MongoDB Atlas

---

# 📂 Project Structure

```
CakeFlow-AI/

client/

components/

pages/

hooks/

context/

assets/

server/

controllers/

models/

routes/

middleware/

socket/

config/

uploads/

database/

README.md
```

---

# ⚙ Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/CakeFlow-AI.git
```

---

## Install Frontend

```bash
cd client

npm install

npm run dev
```

---

## Install Backend

```bash
cd server

npm install

npm run dev
```

---

# 🔐 Environment Variables

```
PORT=

MONGO_URI=

JWT_SECRET=

CLIENT_URL=

EMAIL_USER=

EMAIL_PASS=
```

---

# 📦 Main Modules

- QR Code Ordering
- Live Kitchen Dashboard
- Order Management
- Table Management
- Billing
- Inventory
- Authentication
- Analytics
- Notifications

---

# 📈 Future Enhancements

- AI Demand Prediction
- AI Inventory Forecast
- Voice Ordering
- WhatsApp Notification
- Push Notification
- Kitchen Display TV Mode
- Smart Recommendation System
- Offline Mode
- PWA Support
- AI Chat Assistant

---

# 📸 Screenshots

Add screenshots here after completing the project.

- Home Page
- Customer Menu
- Kitchen Dashboard
- Waiter Dashboard
- Admin Dashboard
- Analytics
- QR Ordering
- Mobile View

---

# 🎯 Project Goals

- Reduce Waiting Time
- Improve Kitchen Efficiency
- Minimize Order Errors
- Real-Time Communication
- Digital Restaurant Experience
- Contactless Ordering
- Better Customer Experience

---

# 🤝 Contribution

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push the branch
5. Open a Pull Request

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Developer

**Jegathis**

Frontend Developer | Full Stack Developer

GitHub: https://github.com/J-egathis

---

<div align="center">

### ⭐ If you like this project, don't forget to Star the Repository ⭐

Made with ❤️ using React, Node.js, MongoDB & Socket.IO

</div>
