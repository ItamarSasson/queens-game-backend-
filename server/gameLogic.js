// Board generation and validation utilities
const BOARD_SIZE = 8;
const NUM_REGIONS = 8;

// Function to generate a valid puzzle board with colored regions
function generatePuzzleBoard() {
  // Step 1: Generate random colored regions
  const regions = generateRegions();
  
  // Step 2: Find a valid solution (placement of 8 queens)
  const solution = findSolution(regions);
  
  // Return the board configuration
  return {
    regions,
    solution
  };
}

// Generate random colored regions on the board
function generateRegions() {
  // Start with empty regions
  const regions = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
  
  // Track which region IDs have been used
  const usedRegionIds = new Set();
  
  // For each region (0 to 7)
  for (let regionId = 0; regionId < NUM_REGIONS; regionId++) {
    // Start at a random empty cell
    let startRow, startCol;
    do {
      startRow = Math.floor(Math.random() * BOARD_SIZE);
      startCol = Math.floor(Math.random() * BOARD_SIZE);
    } while (regions[startRow][startCol] !== null);
    
    // Grow the region using flood fill
    const cellsInRegion = growRegion(regions, startRow, startCol, regionId);
    
    // If region is too small, try again
    if (cellsInRegion < 3) {
      regionId--; // Retry this region
      // Reset the cells we just filled
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (regions[row][col] === regionId) {
            regions[row][col] = null;
          }
        }
      }
    } else {
      usedRegionIds.add(regionId);
    }
  }
  
  // Ensure all cells have a region
  let allCellsFilled = true;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (regions[row][col] === null) {
        allCellsFilled = false;
        break;
      }
    }
    if (!allCellsFilled) break;
  }
  
  // If not all cells are filled, try again
  if (!allCellsFilled || usedRegionIds.size !== NUM_REGIONS) {
    return generateRegions();
  }
  
  return regions;
}

// Grow a region from a starting cell using flood fill algorithm
function growRegion(regions, startRow, startCol, regionId) {
  // Set the starting cell's region
  regions[startRow][startCol] = regionId;
  
  // Keep track of cells in this region
  let cellsInRegion = 1;
  
  // Queue of cells to process (start with our initial cell)
  const queue = [{row: startRow, col: startCol}];
  
  // Target size for this region (random between 3 and 12)
  const targetSize = Math.floor(Math.random() * 10) + 3;
  
  // Process queue until empty or region reaches target size
  while (queue.length > 0 && cellsInRegion < targetSize) {
    // Get random cell from queue
    const randomIndex = Math.floor(Math.random() * queue.length);
    const {row, col} = queue[randomIndex];
    queue.splice(randomIndex, 1);
    
    // Check adjacent cells (up, right, down, left)
    const directions = [
      {dr: -1, dc: 0}, // up
      {dr: 0, dc: 1},  // right
      {dr: 1, dc: 0},  // down
      {dr: 0, dc: -1}  // left
    ];
    
    for (const {dr, dc} of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      // Check if cell is within bounds and not already assigned
      if (
        newRow >= 0 && newRow < BOARD_SIZE &&
        newCol >= 0 && newCol < BOARD_SIZE &&
        regions[newRow][newCol] === null
      ) {
        // Add to region
        regions[newRow][newCol] = regionId;
        cellsInRegion++;
        
        // Add to queue for further processing
        queue.push({row: newRow, col: newCol});
        
        // Stop if we've reached target size
        if (cellsInRegion >= targetSize) break;
      }
    }
  }
  
  return cellsInRegion;
}

// Find a valid solution (placement of 8 queens)
function findSolution(regions) {
  // Create a board to track queen placements
  const board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(false));
  
  // Track which regions, rows, and columns have queens
  const usedRegions = new Set();
  const usedRows = new Set();
  const usedCols = new Set();
  
  // Solution array to store queen positions
  const solution = [];
  
  // Try to place queens using backtracking
  if (placeQueens(0)) {
    return solution;
  }
  
  // If no solution found, generate a new board
  return null;
  
  // Recursive function to place queens
  function placeQueens(row) {
    // If we've placed all 8 queens, we're done
    if (row >= BOARD_SIZE) {
      return true;
    }
    
    // If this row already has a queen, move to next row
    if (usedRows.has(row)) {
      return placeQueens(row + 1);
    }
    
    // Try each column in this row
    for (let col = 0; col < BOARD_SIZE; col++) {
      const regionId = regions[row][col];
      
      // Skip if column or region already has a queen
      if (usedCols.has(col) || usedRegions.has(regionId)) {
        continue;
      }
      
      // Check if placing a queen here would attack any existing queens
      if (isUnderAttack(row, col, solution)) {
        continue;
      }
      
      // Place queen
      usedRows.add(row);
      usedCols.add(col);
      usedRegions.add(regionId);
      solution.push({row, col});
      
      // Recursively place queens in next rows
      if (placeQueens(row + 1)) {
        return true;
      }
      
      // If we couldn't place all queens, backtrack
      usedRows.delete(row);
      usedCols.delete(col);
      usedRegions.delete(regionId);
      solution.pop();
    }
    
    // Couldn't place a queen in this row
    return false;
  }
}

// Check if a position is under attack by any existing queens
function isUnderAttack(row, col, queens) {
  for (const queen of queens) {
    // Check diagonal attacks
    if (
      Math.abs(queen.row - row) === Math.abs(queen.col - col)
    ) {
      return true;
    }
  }
  return false;
}

// Validate a queen placement
function validateQueenPlacement(board, row, col, queens) {
  const regionId = board.regions[row][col];
  
  // Check if there's already a queen in this row
  if (queens.some(queen => queen.row === row)) {
    return { valid: false, message: "There's already a queen in this row" };
  }
  
  // Check if there's already a queen in this column
  if (queens.some(queen => queen.col === col)) {
    return { valid: false, message: "There's already a queen in this column" };
  }
  
  // Check if there's already a queen in this region
  if (queens.some(queen => board.regions[queen.row][queen.col] === regionId)) {
    return { valid: false, message: "There's already a queen in this region" };
  }
  
  // Check diagonal attacks
  for (const queen of queens) {
    if (Math.abs(queen.row - row) === Math.abs(queen.col - col)) {
      return { valid: false, message: "Queens cannot attack each other diagonally" };
    }
  }
  
  return { valid: true };
}

module.exports = {
  generatePuzzleBoard,
  validateQueenPlacement,
  BOARD_SIZE,
  NUM_REGIONS
};
