# How to Run the React Application

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

## Installation Steps

### 1. Install Dependencies

Open a terminal in the `reactjs-version` directory and run:

```bash
npm install
```

This will install all required dependencies including:
- React and React DOM
- html2canvas
- Vite (development server)

### 2. Start the Development Server

Run the following command:

```bash
npm run dev
```

This will:
- Start the Vite development server
- Open your browser automatically at `http://localhost:3000`
- Enable hot module replacement (changes will reload automatically)

### 3. Build for Production

To create a production build:

```bash
npm run build
```

This creates an optimized build in the `dist` folder.

### 4. Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, Vite will automatically try the next available port. Check the terminal output for the actual URL.

### Module Not Found Errors

If you encounter module errors, try:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Browser Doesn't Open Automatically

If the browser doesn't open automatically, check the terminal for the local URL (usually `http://localhost:3000`) and open it manually.

## Project Structure

```
reactjs-version/
├── src/
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── DrawingTool.jsx      # Drawing tool component
├── DrawingTool.css      # Component styles
├── drawingUtils.js      # Utility functions
├── index.html           # HTML template
├── vite.config.js      # Vite configuration
└── package.json         # Dependencies and scripts
```

## Notes

- The app uses Vite for fast development and building
- Hot Module Replacement (HMR) is enabled for instant updates
- All changes to source files will automatically reload in the browser

