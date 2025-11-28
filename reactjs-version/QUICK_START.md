# Quick Start Guide

## 🚀 Run the Application in 3 Steps

### Step 1: Navigate to the project directory
```bash
cd reactjs-version
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Start the development server
```bash
npm run dev
```

That's it! The application will open automatically in your browser at `http://localhost:3000`

## 📋 What You'll See

- A fully functional drawing tool with canvas
- Multiple drawing tools (pencil, line, rectangle, circle, eraser, polygons, text)
- Style options for lines and rectangles
- Ability to add pins and annotations
- Image capture functionality

## 🛠️ Commands Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## ⚠️ Troubleshooting

**If you get "command not found" errors:**
- Make sure Node.js is installed: `node --version`
- Make sure npm is installed: `npm --version`

**If port 3000 is busy:**
- Vite will automatically use the next available port
- Check the terminal for the actual URL

**If modules are missing:**
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📁 Project Structure

```
reactjs-version/
├── src/
│   ├── App.jsx          # Main app (uses DrawingTool)
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── DrawingTool.jsx      # Drawing component
├── DrawingTool.css      # Component styles
├── drawingUtils.js      # Helper functions
└── package.json         # Dependencies
```

## 🎯 Next Steps

1. Customize the component in `src/App.jsx`
2. Modify styles in `DrawingTool.css`
3. Add new features to `DrawingTool.jsx`

Happy coding! 🎨

