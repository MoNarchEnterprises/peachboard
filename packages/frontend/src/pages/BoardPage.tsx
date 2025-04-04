import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { supabase } from '../lib/supabaseClient';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { FaPen, FaEraser } from 'react-icons/fa'; // Import icons

// Define an interface for the board object
interface Board {
  id: string;
  created_at: string;
  name: string;
  owner_id: string;
  share_link_id: string | null;
}

// Define an interface for a single line drawn
interface DrawnLine {
  points: number[];
  tool: 'pen' | 'eraser';
  color: string;
  strokeWidth: number;
}

// Styled Components
const BoardPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  overflow: hidden;
`;

const TopNavBar = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #FFE5B4;
  border-bottom: 1px solid #ffdab0;
  flex-shrink: 0;
`;

const BoardTitle = styled.h1`
  font-size: 1.5em;
  color: #333;
  margin: 0;
`;

const DashboardLink = styled(Link)`
  text-decoration: none;
  color: #D2691E;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
    color: #A0522D;
  }
`;

const WhiteboardArea = styled.main`
  flex-grow: 1;
  background-color: #ffffff; /* White background for canvas */
  overflow: hidden; /* Hide overflow, stage handles scrolling/zooming if needed */
  position: relative; /* Needed for absolute positioning of status messages if required */
`;

const StatusMessage = styled.p<{ isError?: boolean }>`
  position: absolute; /* Position message over the canvas area */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: ${props => props.isError ? 'red' : '#555'};
  background-color: rgba(255, 255, 255, 0.8); /* Semi-transparent background */
  padding: 10px 20px;
  border-radius: 5px;
  z-index: 10;
`;

const ToolBar = styled.div`
  padding: 8px 20px;
  background-color: #FAFAD2; /* Light yellow background */
  border-bottom: 1px solid #E6E6AA; /* Darker yellow border */
  display: flex;
  align-items: center;
  gap: 15px;
  flex-shrink: 0; /* Prevent toolbar from shrinking */

  label {
    margin-right: 5px;
    font-size: 0.9em;
  }

  input[type="color"] {
    width: 40px;
    height: 25px;
    border: 1px solid #ccc;
    padding: 0 2px;
    cursor: pointer;
  }

  input[type="range"] {
    cursor: pointer;
  }

  button {
    padding: 5px 10px;
    cursor: pointer;
    border: 1px solid #ccc;
    background-color: #fff; /* Default white background */
    border-radius: 4px;
    transition: background-color 0.2s, border-color 0.2s; /* Add transition */
    &.active {
      background-color: #98FB98; /* Light green for active */
      border-color: #76c876; /* Darker green border for active */
    }
    &:hover:not(.active) { /* Add hover style for non-active buttons */
       background-color: #f0f0f0;
    }
  }
`;

const ZoomControls = styled.div`
  position: absolute;
  bottom: 15px;
  right: 15px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 5px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 5; /* Below status message, above canvas */

  label {
    font-size: 0.8em;
  }

  input {
    width: 50px;
    font-size: 0.8em;
    padding: 2px 4px;
    border: 1px solid #ccc;
    border-radius: 3px;
    text-align: right;
  }

  span {
     font-size: 0.8em;
     min-width: 10px; /* Prevent layout shift */
  }
`;

// Zoom limits
const MIN_SCALE = 0.02; // 2%
const MAX_SCALE = 8.0;  // 800%

// BoardPage Component (Re-added React.FC type annotation)
const BoardPage: React.FC = () => {
  const { boardId } = useParams<{ boardId?: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Konva state
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const lastDist = useRef(0); // For pinch zoom distance
  const lastCenter = useRef<{ x: number; y: number } | null>(null); // For pinch zoom center
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the WhiteboardArea container
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [zoomInputValue, setZoomInputValue] = useState('100'); // Input field value as string %

  // Tool state
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [strokeColor, setStrokeColor] = useState('#df4b26'); // Default color
  const [strokeWidth, setStrokeWidth] = useState(5); // Default width

  // --- Fetch Board Details Effect ---
  useEffect(() => {
    const fetchBoardDetails = async () => {
       if (!boardId) {
        setError('No board ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('peachboards')
          .select('*')
          .eq('id', boardId)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
             setError(`Board not found or you don't have permission to view it.`);
          } else {
            throw fetchError;
          }
        }

        if (data) {
          setBoard(data);
          // TODO: Fetch existing lines for this board from Supabase
        } else if (!fetchError) {
           setError(`Board not found or you don't have permission to view it.`);
        }
      } catch (err: any) {
        console.error('Error fetching board details:', err);
        setError(`Failed to load board: ${err.message || 'Unknown error'}`);
        setBoard(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBoardDetails();
  }, [boardId]);

 // --- Stage Resize Effect ---
 useEffect(() => {
  const checkSize = () => {
    if (containerRef.current) {
      setStageSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    }
  };
  checkSize();
  window.addEventListener('resize', checkSize);
  return () => window.removeEventListener('resize', checkSize);
}, []);

// --- Update Zoom Input Effect ---
useEffect(() => {
  setZoomInputValue(Math.round(stageScale * 100).toString());
}, [stageScale]);

  // --- Konva Event Handlers (wrapped in useCallback) ---
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;
    const stage = e.target.getStage();
    if (!stage) return;
    // Use getRelativePointerPosition for drawing relative to stage scale/pos
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    // Start a new line using the current state
    // Start a new line with current tool settings
    setLines((prevLines) => [
      ...prevLines,
      { points: [pos.x, pos.y], tool, color: strokeColor, strokeWidth },
    ]);
     // TODO: Send new line start event via Supabase Realtime
  }, [tool, strokeColor, strokeWidth]); // Add dependencies

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getRelativePointerPosition();
    if (!point) return;

    // Update the last line using the functional form of setLines
    setLines((prevLines) => {
      const lastLine = prevLines[prevLines.length - 1];
      if (lastLine) {
        // Add new points to the current line
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        // Return a new array with the updated last line
        return [...prevLines.slice(0, -1), lastLine];
      }
      return prevLines; // Should not happen if mouseDown worked
    });
     // TODO: Send line update event via Supabase Realtime (throttle this)
  }, []); // Dependency array is empty

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false;
     // TODO: Send line end event via Supabase Realtime / save final line state
  }, []); // Dependency array is empty

  // --- Touch Event Handlers (wrapped in useCallback) ---
  const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const touches = e.evt.touches;
    const stage = e.target.getStage();
    if (!stage) return;

    if (touches.length === 1) {
      // Start drawing
      isDrawing.current = true;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      setLines((prevLines) => [
        ...prevLines,
        { points: [pos.x, pos.y], tool, color: strokeColor, strokeWidth },
      ]);
      // TODO: Send new line start event
    } else if (touches.length >= 2) {
      // Start pinch zoom
      isDrawing.current = false; // Stop drawing if starting pinch
      const touch1 = touches[0];
      const touch2 = touches[1];
      lastDist.current = getDistance(
        { x: touch1.clientX, y: touch1.clientY },
        { x: touch2.clientX, y: touch2.clientY }
      );
      lastCenter.current = getCenter(
         { x: touch1.clientX, y: touch1.clientY },
         { x: touch2.clientX, y: touch2.clientY }
      );
    }
  }, [tool, strokeColor, strokeWidth]);

  // Helper function to calculate distance between two points
  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // Helper function to calculate center between two points
  const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  };


  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const touches = e.evt.touches;
    const stage = e.target.getStage();
     if (!stage) return;

    if (touches.length === 1 && isDrawing.current) {
      // Continue drawing
      const point = stage.getRelativePointerPosition();
      if (!point) return;
      setLines((prevLines) => {
        const lastLine = prevLines[prevLines.length - 1];
        if (lastLine) {
          lastLine.points = lastLine.points.concat([point.x, point.y]);
          return [...prevLines.slice(0, -1), lastLine];
        }
        return prevLines;
      });
      // TODO: Send line update event
    } else if (touches.length >= 2 && lastCenter.current) {
       // Handle pinch zoom
       isDrawing.current = false; // Ensure drawing stops during pinch
       const touch1 = touches[0];
       const touch2 = touches[1];
       const newCenter = getCenter(
         { x: touch1.clientX, y: touch1.clientY },
         { x: touch2.clientX, y: touch2.clientY }
       );
       const newDist = getDistance(
         { x: touch1.clientX, y: touch1.clientY },
         { x: touch2.clientX, y: touch2.clientY }
       );

       if (lastDist.current === 0) {
         lastDist.current = newDist; // Avoid division by zero on first move
         return;
       }

       let scale = stage.scaleX() * (newDist / lastDist.current);
       scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)); // Clamp scale

       // Calculate new position to keep center fixed
       const dx = newCenter.x - lastCenter.current.x;
       const dy = newCenter.y - lastCenter.current.y;

       const newPos = {
         x: newCenter.x - ((newCenter.x - stage.x() - dx) / stage.scaleX()) * scale,
         y: newCenter.y - ((newCenter.y - stage.y() - dy) / stage.scaleY()) * scale,
       };

       setStageScale(scale);
       setStagePos(newPos);

       lastDist.current = newDist;
       lastCenter.current = newCenter;
    }
  }, [stageScale]); // Add stageScale dependency

  const handleTouchEnd = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    isDrawing.current = false;
    lastDist.current = 0; // Reset pinch distance
    lastCenter.current = null; // Reset pinch center
    // TODO: Send line end event if a line was being drawn before pinch/end
  }, []);

  // --- Zoom Handler ---
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault(); // Prevent page scrolling

    const stage = e.target.getStage();
    if (!stage) return;

    const scaleBy = 1.05; // Zoom factor
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // Determine new scale based on scroll direction
    let direction = e.evt.deltaY > 0 ? -1 : 1; // -1 for zoom out, 1 for zoom in

    // Apply zoom limits if desired (e.g., min 0.1, max 10)
    // if (e.evt.ctrlKey) { direction = -direction; } // Optional: Reverse direction with Ctrl

    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Apply scale limits
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    setStageScale(newScale); // Update scale state

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStagePos(newPos); // Update position state

  }, []);

  // --- Zoom Input Handler ---
  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setZoomInputValue(value); // Update input field immediately

    const percentage = parseFloat(value);
    if (!isNaN(percentage) && percentage > 0) {
      let newScale = percentage / 100;
      // Apply scale limits
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      const stage = stageRef.current;
      if (!stage) return;

      // Calculate new position to keep center fixed
      const center = {
        x: stageSize.width / 2,
        y: stageSize.height / 2,
      };

      const oldScale = stageScale; // Use state value

      const mousePointTo = {
        x: (center.x - stagePos.x) / oldScale,
        y: (center.y - stagePos.y) / oldScale,
      };

      const newPos = {
        x: center.x - mousePointTo.x * newScale,
        y: center.y - mousePointTo.y * newScale,
      };

      setStageScale(newScale);
      setStagePos(newPos);
    }
  };

  return (
    <BoardPageContainer>
      <TopNavBar>
        <BoardTitle>{board ? board.name : 'PeachBoard'}</BoardTitle>
        <DashboardLink to="/dashboard">Back to Dashboard</DashboardLink>
      </TopNavBar>
      <ToolBar>
        <label htmlFor="tool-pen">Tool:</label>
        <button
          id="tool-pen"
          onClick={() => setTool('pen')}
          className={tool === 'pen' ? 'active' : ''}
          title="Pen" // Add title for accessibility/tooltip
        >
          <FaPen /> {/* Use Pen icon */}
        </button>
        <button
          id="tool-eraser"
          onClick={() => setTool('eraser')}
          className={tool === 'eraser' ? 'active' : ''}
          title="Eraser" // Add title for accessibility/tooltip
        >
          <FaEraser /> {/* Use Eraser icon */}
        </button>
        <label htmlFor="color-picker">Color:</label>
        <input
          type="color"
          id="color-picker"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          disabled={tool === 'eraser'} // Disable color for eraser
        />
        <label htmlFor="stroke-width">Width:</label>
        <input
          type="range"
          id="stroke-width"
          min="1"
          max="50" // Adjust max width as needed
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
        />
        <span>{strokeWidth}</span> {/* Display current width */}
      </ToolBar> {/* Correct closing tag placement */}
      {/* Assign ref to the container */}
      <WhiteboardArea ref={containerRef}>
        {loading && <StatusMessage>Loading board...</StatusMessage>}
        {error && <StatusMessage isError={true}>{error}</StatusMessage>}
        {!loading && !error && board && (
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            ref={stageRef}
            onWheel={handleWheel} // Add wheel handler
            scaleX={stageScale}   // Apply scale state
            scaleY={stageScale}
            x={stagePos.x}        // Apply position state
            y={stagePos.y}
          >
            {/* Grid Layer (rendered first, underneath drawing) */}
            <Layer listening={false}>
              {(() => {
                // Prevent rendering grid if stage size is not yet determined
                if (!stageSize.width || !stageSize.height) {
                  return null;
                }

                const gridSpacing = 20;
                const gridLineColor = '#e0f2f7';
                const gridLineWidth = 0.5;
                const majorGridLineColor = '#b3e5fc';
                const majorGridLineWidth = 1;
                const majorGridInterval = 5;
                const gridLines = []; // Renamed from lines to avoid conflict

                // Calculate visible bounds in stage coordinates
                const topLeftX = -stagePos.x / stageScale;
                const topLeftY = -stagePos.y / stageScale;
                const bottomRightX = (-stagePos.x + stageSize.width) / stageScale;
                const bottomRightY = (-stagePos.y + stageSize.height) / stageScale;

                // Calculate start and end indices for loops based on visible area
                const startXIndex = Math.floor(topLeftX / gridSpacing);
                const endXIndex = Math.ceil(bottomRightX / gridSpacing);
                const startYIndex = Math.floor(topLeftY / gridSpacing);
                const endYIndex = Math.ceil(bottomRightY / gridSpacing);

                // Vertical lines
                for (let i = startXIndex; i <= endXIndex; i++) {
                  const isMajor = i % majorGridInterval === 0;
                  const x = Math.round(i * gridSpacing) + 0.5;
                  gridLines.push(
                    <Line
                      key={`v-${i}`}
                      points={[x, topLeftY, x, bottomRightY]} // Draw across visible height
                      stroke={isMajor ? majorGridLineColor : gridLineColor}
                      strokeWidth={isMajor ? majorGridLineWidth : gridLineWidth}
                    />
                  );
                }

                // Horizontal lines
                for (let j = startYIndex; j <= endYIndex; j++) {
                   const isMajor = j % majorGridInterval === 0;
                   const y = Math.round(j * gridSpacing) + 0.5;
                   gridLines.push(
                    <Line
                      key={`h-${j}`}
                      points={[topLeftX, y, bottomRightX, y]} // Draw across visible width
                      stroke={isMajor ? majorGridLineColor : gridLineColor}
                      strokeWidth={isMajor ? majorGridLineWidth : gridLineWidth}
                    />
                  );
                }
                return gridLines;
              })()}
            </Layer>

            {/* Drawing Layer */}
            <Layer>
              {/* Render all drawn lines */}
              {lines.map((line, i) => (
                <Line
                  key={`line-${i}`} // Use a more specific key prefix
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              ))}
            </Layer>
          </Stage>
        )}
         {!loading && !error && !board && (
           <StatusMessage>Board details could not be loaded.</StatusMessage>
         )}
         {/* Zoom Controls UI */}
         <ZoomControls>
            <label htmlFor="zoom-input">Zoom:</label>
            <input
              type="number"
              id="zoom-input"
              value={zoomInputValue}
              onChange={handleZoomInputChange}
              step="10" // Optional: step value for spinner arrows
            />
            <span>%</span>
         </ZoomControls>
      </WhiteboardArea>
    </BoardPageContainer>
  );
};

export default BoardPage;