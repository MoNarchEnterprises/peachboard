import React, { useState, useEffect, useRef, useCallback } from 'react'; // Import useCallback
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { supabase } from '../lib/supabaseClient';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva'; // Import Konva namespace for types

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
  points: number[]; // Array of [x1, y1, x2, y2, ...]
  // TODO: Add tool type (pen, eraser), color, strokeWidth etc. later
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
  z-index: 10; /* Ensure message is above canvas */
`;

// BoardPage Component (Removed React.FC type annotation)
const BoardPage = () => {
  const { boardId } = useParams<{ boardId?: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Konva state
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the WhiteboardArea container
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

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
    checkSize(); // Initial size check
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []); // Empty dependency array ensures this runs once on mount and cleans up

  // --- Konva Event Handlers (wrapped in useCallback) ---
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    // Start a new line using the current state
    setLines((prevLines) => [...prevLines, { points: [pos.x, pos.y] }]);
     // TODO: Send new line start event via Supabase Realtime
  }, []); // Dependency array is empty for now, might need 'lines' if logic changes

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
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
    e.evt.preventDefault(); // Prevent default touch actions like scrolling
    isDrawing.current = true;
    const touch = e.evt.touches[0];
    const stage = e.target.getStage();
    if (!touch || !stage) return;
    const pos = stage.getPointerPosition(); // Use getPointerPosition for consistency
    if (!pos) return;
    setLines((prevLines) => [...prevLines, { points: [pos.x, pos.y] }]);
    // TODO: Send new line start event via Supabase Realtime
  }, []);

  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault(); // Prevent default touch actions
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const touch = e.evt.touches[0];
    if (!touch || !stage) return;
    const point = stage.getPointerPosition();
    if (!point) return;

    setLines((prevLines) => {
      const lastLine = prevLines[prevLines.length - 1];
      if (lastLine) {
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        return [...prevLines.slice(0, -1), lastLine];
      }
      return prevLines;
    });
    // TODO: Send line update event via Supabase Realtime (throttle this)
  }, []);

  const handleTouchEnd = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault(); // Prevent default touch actions
    isDrawing.current = false;
    // TODO: Send line end event via Supabase Realtime / save final line state
  }, []);

  return (
    <BoardPageContainer>
      <TopNavBar>
        <BoardTitle>{board ? board.name : 'PeachBoard'}</BoardTitle>
        <DashboardLink to="/dashboard">Back to Dashboard</DashboardLink>
      </TopNavBar>
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
          >
            <Layer>
              {/* Render all drawn lines */}
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke="#df4b26" // Default drawing color
                  strokeWidth={5}  // Default line thickness
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={'source-over'} // Default drawing mode
                  // TODO: Use properties from line object (color, width, tool)
                />
              ))}
            </Layer>
          </Stage>
        )}
         {!loading && !error && !board && (
           <StatusMessage>Board details could not be loaded.</StatusMessage>
         )}
      </WhiteboardArea>
    </BoardPageContainer>
  );
};

export default BoardPage;