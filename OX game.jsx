import React, { useRef, useEffect, useState } from 'react';

function App() {
  return (
    <div style={{ textAlign: 'center' }}>
      <GameBoard />
    </div>
  );
}

const LABEL = {
  X: '△',   
  O: '◻'    
};

// Draw helpers
function drawX(ctx, row, col, lineSpacing) {
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  const x = col * lineSpacing;
  const y = row * lineSpacing;
  const padding = lineSpacing / 5;
  ctx.beginPath();
  ctx.moveTo(x + lineSpacing / 2, y + padding);                 // Top point
  ctx.lineTo(x + lineSpacing - padding, y + lineSpacing - padding); // Bottom right
  ctx.lineTo(x + padding, y + lineSpacing - padding);           // Bottom left
  ctx.closePath(); // Connects back to the top point
  ctx.stroke();
}

function drawO(ctx, row, col, lineSpacing) {
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  const x = col * lineSpacing;
  const y = row * lineSpacing;
  const padding = lineSpacing / 5;
  ctx.beginPath();
  ctx.moveTo(x + padding, y + padding);                              // Top-left
  ctx.lineTo(x + lineSpacing - padding, y + padding);                // Top-right
  ctx.lineTo(x + lineSpacing - padding, y + lineSpacing - padding);  // Bottom-right
  ctx.lineTo(x + padding, y + lineSpacing - padding);                // Bottom-left
  ctx.closePath(); // Connects back to top-left
  ctx.stroke();

}

// Winner check for NxN
function calculateWinner(board, gridSize) {
  // rows
  for (let i = 0; i < gridSize; i++) {
    if (board[i][0] && board[i].every(cell => cell === board[i][0])) {
      return board[i][0];
    }
  }
  // cols
  for (let i = 0; i < gridSize; i++) {
    if (board[0][i]) {
      let ok = true;
      for (let j = 1; j < gridSize; j++) {
        if (board[j][i] !== board[0][i]) {
          ok = false;
          break;
        }
      }
      if (ok) return board[0][i];
    }
  }
  // diag TL-BR
  if (board[0][0]) {
    let ok = true;
    for (let i = 1; i < gridSize; i++) {
      if (board[i][i] !== board[0][0]) {
        ok = false;
        break;
      }
    }
    if (ok) return board[0][0];
  }
  // diag TR-BL
  if (board[0][gridSize - 1]) {
    let ok = true;
    for (let i = 1; i < gridSize; i++) {
      if (board[i][gridSize - 1 - i] !== board[0][gridSize - 1]) {
        ok = false;
        break;
      }
    }
    if (ok) return board[0][gridSize - 1];
  }
  return null;
}

function GameBoard() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const isRestoring = useRef(false);

  const [gridSize, setGridSize] = useState(3);
  const [canvasSize, setCanvasSize] = useState(300);
  const [turn, setTurn] = useState(1); // 1-based; odd=X's turn, even=O's turn
  const [board, setBoard] = useState(
    Array.from({ length: 3 }, () => Array(3).fill(null))
  );
  const [winner, setWinner] = useState(null);


  // Draw grid and pieces
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lineSpacing = canvas.width / gridSize;

    ctx.beginPath();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    for (let i = 1; i < gridSize; i++) {
      ctx.moveTo(lineSpacing * i, 0);
      ctx.lineTo(lineSpacing * i, canvas.height);
      ctx.moveTo(0, lineSpacing * i);
      ctx.lineTo(canvas.width, lineSpacing * i);
    }
    ctx.stroke();

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = board[r][c];
        if (cell === 'X') drawX(ctx, r, c, lineSpacing);
        else if (cell === 'O') drawO(ctx, r, c, lineSpacing);
      }
    }
  }, [board, gridSize]);

 const applyGridSize = (N) => {
  isRestoring.current = false;            // not loading a save
  setGridSize(N);
  setCanvasSize(N * 100);
  setTurn(1);
  setBoard(Array.from({ length: N }, () => Array(N).fill(null)));
  setWinner(null);
};

  // Click to place a mark
  const handleCanvasClick = (event) => {
    if (winner || turn > gridSize * gridSize) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const lineSpacing = canvas.width / gridSize;
    const col = Math.floor(x / lineSpacing);
    const row = Math.floor(y / lineSpacing);

    if (board[row][col]) return;

    const symbol = turn % 2 === 1 ? 'X' : 'O';
    const newBoard = board.map(arr => arr.slice());
    newBoard[row][col] = symbol;

    setBoard(newBoard);

    const w = calculateWinner(newBoard, gridSize);
    if (w) setWinner(w);

    setTurn(turn + 1);
  };

  const handleReset = () => {
    setTurn(1);
    setBoard(Array.from({ length: gridSize }, () => Array(gridSize).fill(null)));
    setWinner(null);
  };

  // ===== JSON Save/Load (spec-compliant) =====
  // Map internal state -> { board: [["X","O"," "]...], turn: "X"|"O"|null, status: ... }
  function toSaveJSON(board, turnNumber, winnerSymbol) {
    const N = board.length;

    // compute status
    let status = 'in_progress';
    if (winnerSymbol === 'X') status = 'X_wins';
    else if (winnerSymbol === 'O') status = 'O_wins';
    else {
      const filled = board.flat().filter(v => v === 'X' || v === 'O').length;
      if (filled === N * N) status = 'draw';
    }

    // turn symbol for JSON
    let turnSymbol = null;
    if (status === 'in_progress') {
      turnSymbol = turnNumber % 2 === 1 ? 'X' : 'O';
    }

    // convert null -> " "
    const jsonBoard = board.map(row =>
      row.map(cell => (cell === null ? ' ' : cell))
    );

    return {
      board: jsonBoard,
      turn: turnSymbol, // "X" | "O" | null
      status            // "in_progress" | "X_wins" | "O_wins" | "draw"
    };
  }

  // Map JSON -> internal state (with validation)
  function fromSaveJSON(data) {
    if (!data || !Array.isArray(data.board) || data.board.length === 0) {
      throw new Error('Invalid: board missing');
    }

    const N = data.board.length;
    if (!data.board.every(row => Array.isArray(row) && row.length === N)) {
      throw new Error('Invalid: board must be N x N');
    }

    const allowedCell = new Set(['X', 'O', ' ']);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!allowedCell.has(data.board[r][c])) {
          throw new Error('Invalid: board cell must be "X","O"," "');
        }
      }
    }

    const allowedStatus = new Set(['in_progress', 'X_wins', 'O_wins', 'draw']);
    if (!allowedStatus.has(data.status)) {
      throw new Error('Invalid: status');
    }

    const allowedTurn = new Set(['X', 'O', null]);
    if (!allowedTurn.has((data.turn ?? null))) {
      throw new Error('Invalid: turn');
    }

    // " " -> null
    const restoredBoard = data.board.map(row =>
      row.map(cell => (cell === ' ' ? null : cell))
    );

    let restoredWinner = null;
    if (data.status === 'X_wins') restoredWinner = 'X';
    if (data.status === 'O_wins') restoredWinner = 'O';

    // derive a turn number for internal logic
    const filled = restoredBoard.flat().filter(v => v === 'X' || v === 'O').length;
    let turnNumber;
    if (data.status === 'in_progress') {
      turnNumber = filled + 1;
    } else {
      // game finished; push over max to block further moves
      turnNumber = N * N + 1;
    }

    return {
      gridSize: N,
      board: restoredBoard,
      winner: restoredWinner,
      turnNumber
    };
  }

  const downloadSaveJSON = () => {
    try {
      const payload = toSaveJSON(board, turn, winner);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tic-tac-toe.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to create save file.');
    }
  };

  const uploadSaveJSON = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = JSON.parse(e.target.result);
        const restored = fromSaveJSON(raw);

        isRestoring.current = true;
        setGridSize(restored.gridSize);
        setCanvasSize(restored.gridSize * 100);
        setBoard(restored.board);
        setWinner(restored.winner);
        setTurn(restored.turnNumber);
      } catch (err) {
        console.error(err);
        alert('Invalid JSON save.');
      } finally {
        event.target.value = ''; // allow re-uploading the same file
      }
    };
    reader.readAsText(file);
  };
  // ===========================================

  let status;
  if (winner) {
    status = 'Winner: ' + (LABEL[winner] || winner);
  } else if (turn > gridSize * gridSize) {
    status = "It's a Draw!";
  } else {
    const current = turn % 2 === 1 ? 'X' : 'O';
    status = 'Turn ' + turn + ': ' + (LABEL[current] || current);
  }


  return (
    <>
      <h1>Tic Tac Toe</h1>

      <div style={{ margin: '10px 0' }}>
        <button onClick={() => applyGridSize(3)} style={{ marginRight: '5px' }}>3x3</button>
        <button onClick={() => applyGridSize(4)} style={{ marginRight: '5px' }}>4x4</button>
        <button onClick={() => applyGridSize(5)} style={{ marginRight: '5px' }}>5x5</button>
      </div>


      <h2>{status}</h2>

      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ border: '1px solid black' }}
        onClick={handleCanvasClick}
      />

      <div style={{ marginTop: '10px' }}>
        <button onClick={handleReset} style={{ marginRight: '6px' }}>
          Reset
        </button>
        <button onClick={downloadSaveJSON} style={{ marginRight: '6px' }}>
          Download Save
        </button>
        <button onClick={() => fileInputRef.current && fileInputRef.current.click()}>
          Upload Save
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={uploadSaveJSON}
          style={{ display: 'none' }}
        />
      </div>
    </>
  );
}

export default App;
