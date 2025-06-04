# Tak Game - Complete Implementation

A full-featured implementation of the beautiful board game Tak, built with React, Three.js, and Convex backend. This implementation includes complete game rules, 3D visualization, real-time multiplayer, and comprehensive game management.

## 🎮 Features

### Core Game Features
- **Complete Tak Rule Implementation**: All official Tak rules including:
  - Board sizes from 3×3 to 8×8
  - Flat stones, standing stones (walls), and capstones
  - Stack movement with drop patterns
  - Road and flat win conditions
  - Opening phase (first two moves with opponent's pieces)
  - Piece limits based on board size
  - Komi system for tie-breaking

### Visual Features
- **3D Board Visualization**: Beautiful Three.js 3D board with:
  - Interactive piece placement and movement
  - Real-time piece stacking visualization
  - Visual distinction between piece types
  - Selected square highlighting
  - Responsive camera controls

### Multiplayer Features
- **Real-time Multiplayer**: Powered by Convex with:
  - Instant move synchronization
  - Live game state updates
  - Player authentication
  - Game history tracking

### User Interface
- **Modern React UI**: Clean, responsive interface with:
  - Game lobby with available games
  - Game creation with customizable settings
  - Interactive game controls
  - Move history display
  - Piece count tracking
  - Resignation functionality

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Convex account (free at [convex.dev](https://convex.dev))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tak-game.git
   cd tak-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Convex backend**
   ```bash
   npx convex dev
   ```
   Follow the prompts to set up your Convex project.

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 🎯 How to Play

### Game Setup
1. **Create Account**: Sign up or sign in anonymously
2. **Create Game**: Choose board size (3×3 to 8×8), komi, and ranked options
3. **Wait for Opponent**: Share game link or wait for someone to join
4. **Start Playing**: Game begins automatically when both players join

### Game Rules

#### Pieces
- **Flat Stones**: Basic pieces that can form roads and count for flat wins
- **Standing Stones (Walls)**: Block roads but can be flattened by capstones
- **Capstones**: Special pieces that can flatten walls and count as road pieces

#### Winning
- **Road Win**: Connect opposite edges of the board with your pieces
- **Flat Win**: Control the most flat-topped stacks when the board fills or pieces run out
- **Resignation**: Opponent wins if you resign

#### Special Rules
- **Opening Phase**: First two moves place opponent's pieces (first move must be flat)
- **Stack Movement**: Move stacks in straight lines, dropping pieces along the path
- **Carry Limit**: Can't carry more pieces than the board size

### Controls
- **Place Mode**: Click empty squares to place pieces
- **Move Mode**: Click your stack to select, then click destination
- **Stack Size**: Use slider to choose how many pieces to move
- **Drop Pattern**: Customize how pieces are distributed along the path

## 🏗️ Architecture

### Frontend (React + Vite)
- **React 18**: Modern functional components with hooks
- **Three.js**: 3D board visualization and interaction
- **TypeScript**: Full type safety throughout
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast development and optimized builds

### Backend (Convex)
- **Real-time Database**: Automatic synchronization across clients
- **Authentication**: Built-in user management
- **Serverless Functions**: Mutations for game logic, queries for data
- **Type Safety**: End-to-end TypeScript integration

### Project Structure
```
src/
├── components/          # React components
│   ├── Board3D.tsx     # 3D game board with Three.js
│   ├── GameBoard.tsx   # Main game interface
│   ├── GameControls.tsx # Game control panel
│   ├── GameInfo.tsx    # Game status display
│   ├── GameLobby.tsx   # Game browser and history
│   └── CreateGameForm.tsx # Game creation form
├── App.tsx             # Main application component
└── main.tsx           # Application entry point

convex/
├── schema.ts          # Database schema definition
├── games.ts           # Game logic and data operations
├── auth.ts            # Authentication configuration
└── _generated/        # Auto-generated Convex types
```

## 🔧 Development

### Key Technologies
- **React 18**: Component framework
- **Three.js**: 3D graphics and interaction
- **Convex**: Backend-as-a-service with real-time sync
- **TypeScript**: Type safety and developer experience
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Build tool and dev server

### Game State Management
The game state is managed entirely by Convex with:
- **Games table**: Stores game metadata, board state, and piece counts
- **Moves table**: Complete move history with PTN notation
- **Real-time sync**: All players see updates instantly
- **Optimistic updates**: UI updates immediately for better UX

### 3D Visualization
The Three.js board features:
- **Dynamic scene**: Pieces are added/removed based on game state
- **Interactive raycasting**: Click detection on 3D board squares
- **Material differentiation**: White/black pieces with different materials
- **Shape coding**: Cylinders for flats, boxes for walls, tapered cylinders for capstones

## 📝 Game Rules Reference

### Piece Counts by Board Size
- **3×3**: 10 flats, 0 capstones per player
- **4×4**: 15 flats, 0 capstones per player  
- **5×5**: 21 flats, 1 capstone per player
- **6×6**: 30 flats, 1 capstone per player
- **7×7**: 40 flats, 2 capstones per player
- **8×8**: 50 flats, 2 capstones per player

### Win Conditions
1. **Road Win** (immediate): Connect any two opposite edges of the board
2. **Flat Win** (end game): Have the most flat-topped stacks when:
   - The board is completely filled, OR
   - A player runs out of pieces

### Movement Rules
- **Stack Control**: You control a stack if your piece is on top
- **Carry Limit**: Maximum pieces you can carry equals the board size
- **Drop Pattern**: Must drop at least one piece per square moved
- **Wall Flattening**: Only capstones can flatten walls, and only on the final drop

## 🚀 Deployment

### Deploy to Vercel (Recommended)
1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy Convex to production**
   ```bash
   npx convex deploy
   ```

3. **Deploy frontend to Vercel**
   - Connect your GitHub repository to Vercel
   - Vercel will automatically detect the Vite configuration
   - Set environment variables if needed

### Environment Variables
- `VITE_CONVEX_URL`: Your Convex deployment URL (automatically set by Convex)

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Setup
```bash
# Install dependencies
npm install

# Start Convex in development mode
npx convex dev

# Start the frontend dev server
npm run dev

# Run linting
npm run lint

# Run type checking
npm run type-check
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Acknowledgments

- **Tak** was designed by James Ernest and Patrick Rothfuss
- **Three.js** community for excellent 3D web graphics
- **Convex** team for the amazing real-time backend platform
- **React** team for the fantastic UI framework

## 🐛 Bug Reports

If you find a bug, please open an issue with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## 📞 Support

For questions or support:
- Open a GitHub issue
- Check existing issues and discussions
- Review the game rules at [tak.games](https://tak.games)

---

**Enjoy playing Tak!** 🎮✨
