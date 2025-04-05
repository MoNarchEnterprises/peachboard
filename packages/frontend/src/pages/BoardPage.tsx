import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js'; // Import type
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { FaPen, FaEraser, FaShareAlt } from 'react-icons/fa'; // Import icons + Share icon

// Define an interface for the board object
interface Board {
  id: string;
  created_at: string;
  name: string;
  owner_id: string;
  share_link_id: string | null;
}

// Interface for line data stored in DB and state
interface LineData {
  id?: string; // Optional ID from DB
  points: number[];
  tool: 'pen' | 'eraser';
  color: string;
  strokeWidth: number;
  creator_id?: string; // Optional creator ID
}

// Interface for the raw DB row
interface BoardLineRow {
  id: string;
  board_id: string;
  creator_id: string | null;
  line_data: Omit<LineData, 'id' | 'creator_id'>; // The JSONB column itself
  created_at: string;
}

// Styled Components
const BoardPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%; /* Use percentage instead of vw */
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

const NavButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  margin-left: 10px;
  cursor: pointer;
  color: #D2691E;
  font-size: 1.2em;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
    color: #A0522D;
  }
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

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const WhiteboardArea = styled.main`
  flex-grow: 1;
  background-color: #ffffff;
  overflow: hidden;
  position: relative;
  width: 100%; /* Explicitly set width */
`;

const StatusMessage = styled.p<{ isError?: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: ${props => props.isError ? 'red' : '#555'};
  background-color: rgba(255, 255, 255, 0.8);
  padding: 10px 20px;
  border-radius: 5px;
  z-index: 10;
`;

const ToolBar = styled.div`
  padding: 8px 20px;
  background-color: #FAFAD2;
  border-bottom: 1px solid #E6E6AA;
  display: flex;
  align-items: center;
  gap: 15px;
  flex-shrink: 0;

  label { margin-right: 5px; font-size: 0.9em; }
  input[type="color"] { width: 40px; height: 25px; border: 1px solid #ccc; padding: 0 2px; cursor: pointer; }
  input[type="range"] { cursor: pointer; }
  button { padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; background-color: #fff; border-radius: 4px; transition: background-color 0.2s, border-color 0.2s; }
  button.active { background-color: #98FB98; border-color: #76c876; }
  button:hover:not(.active) { background-color: #f0f0f0; }
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
  z-index: 5;

  label { font-size: 0.8em; }
  input { width: 50px; font-size: 0.8em; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; text-align: right; }
  span { font-size: 0.8em; min-width: 10px; }
`;

// Zoom limits
const MIN_SCALE = 0.02;
const MAX_SCALE = 8.0;

// Helper functions
const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};
const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
};

// BoardPage Component
const BoardPage = () => { // No React.FC
  // Get both potential params from the URL
  const { boardId, shareLinkId } = useParams<{ boardId?: string, shareLinkId?: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Konva state
  const [lines, setLines] = useState<LineData[]>([]); // Use LineData interface
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false); // Ref to track panning state
  const panStartPoint = useRef<{ x: number; y: number } | null>(null); // Ref for pan start coords
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [zoomInputValue, setZoomInputValue] = useState('100');

  // Tool state
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [strokeColor, setStrokeColor] = useState('#df4b26');
  const [strokeWidth, setStrokeWidth] = useState(5);

  // --- Function to fetch initial lines ---
  const fetchInitialLines = useCallback(async (currentBoardId: string) => { // Wrap in useCallback
    console.log("Fetching initial lines for board:", currentBoardId);
    try {
      const { data, error: selectError } = await supabase
        .from('board_lines')
        .select('*')
        .eq('board_id', currentBoardId);

      if (selectError) throw selectError;

      const initialLines = data?.map(line => ({
        id: line.id,
        creator_id: line.creator_id,
        ...(line.line_data as Omit<LineData, 'id' | 'creator_id'>)
      })) || [];

      console.log("Fetched initial lines:", initialLines);
      setLines(initialLines);

    } catch (err: any) {
      console.error("Error fetching initial lines:", err);
      setError(prev => prev ? `${prev}\nFailed to fetch lines.` : 'Failed to fetch lines.');
    }
  }, []); // Empty dependency array for fetchInitialLines

  // --- Fetch Board Details Effect ---
  useEffect(() => {
    const fetchBoardDetails = async () => {
      setLoading(true);
      setError(null);
      setBoard(null);
      setLines([]); // Clear lines when fetching new board

      try {
        let query = supabase.from('peachboards').select('*');

        if (shareLinkId) {
          console.log("Fetching board by share link ID:", shareLinkId);
          query = query.eq('share_link_id', shareLinkId);
        } else if (boardId) {
          console.log("Fetching board by board ID:", boardId);
          query = query.eq('id', boardId);
        } else {
          setError('No board ID or share link ID provided.');
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
             setError(`Board not found or access denied.`);
          } else {
            console.error('Supabase fetch error:', fetchError);
            setError(`Error loading board: ${fetchError.message}`);
          }
        } else if (data) {
          console.log("Board data fetched:", data);
          setBoard(data);
          // Fetch lines after board is confirmed
          fetchInitialLines(data.id);
        } else {
           setError(`Board not found.`);
        }

      } catch (err: any) {
        console.error('Error fetching board details:', err);
        setError(`Failed to load board: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchBoardDetails();
  }, [boardId, shareLinkId, fetchInitialLines]); // Add fetchInitialLines to dependency array

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

  // --- Realtime Subscription Effect ---
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    if (board?.id) {
      const currentBoardId = board.id; // Capture board id for cleanup
      console.log(`Subscribing to Realtime for board: ${currentBoardId}`);
      channel = supabase
        .channel(`board_${currentBoardId}`)
        // Use the correct type for the payload row
        .on<BoardLineRow>(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'board_lines',
            filter: `board_id=eq.${currentBoardId}`,
          },
          (payload) => {
            console.log('Realtime INSERT received:', payload);
            const newLineRecord = payload.new; // This is now correctly typed as BoardLineRow | undefined

            // Check if the record and its line_data exist and are objects
            if (newLineRecord && typeof newLineRecord.line_data === 'object' && newLineRecord.line_data !== null) {
               // Construct the LineData object for state
               const newLine: LineData = {
                 id: newLineRecord.id, // Get ID from the row
                 creator_id: newLineRecord.creator_id ?? undefined, // Convert null to undefined
                 ...newLineRecord.line_data // Spread the properties from the JSONB column
               };
               console.log("Adding line from Realtime:", newLine);

               // Add line only if it doesn't already exist (simple check by id)
               setLines((prevLines) => {
                 if (!prevLines.some(line => line.id === newLine.id)) {
                   return [...prevLines, newLine];
                 }
                 console.log("Duplicate line detected, skipping add:", newLine.id);
                 return prevLines;
               });
            } else {
              console.warn("Received Realtime insert without valid line_data:", payload);
            }
          }
        )
        .subscribe((status, err) => {
           if (status === 'SUBSCRIBED') {
             console.log(`Realtime subscribed for board: ${currentBoardId}`);
           }
           if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
             console.error(`Realtime subscription error: ${status}`, err);
             setError(prev => prev ? `${prev}\nRealtime connection error.` : 'Realtime connection error.');
           }
         });
    }

    // Cleanup function
    return () => {
      if (channel) {
        console.log(`Unsubscribing from Realtime for board: ${board?.id}`); // Use optional chaining here
        supabase.removeChannel(channel).catch(err => console.error("Error removing channel", err));
      }
    };
  }, [board]); // Re-subscribe if the board changes

  // --- Function to save the last drawn line ---
  const saveLineToDb = useCallback(async () => { // Make async
    if (!board?.id) return;

    const lastLine = lines[lines.length - 1];
    // Check points length >= 4 because a line needs at least two points (x1,y1,x2,y2)
    if (!lastLine || !lastLine.points || lastLine.points.length < 4) {
       console.log("Skipping save for invalid line (dot or single point):", lastLine);
       // Optionally remove the dot from local state if desired
       // setLines(prev => prev.slice(0, -1));
       return;
    }

    const lineDataToSave: Omit<LineData, 'id' | 'creator_id'> = {
        points: lastLine.points,
        tool: lastLine.tool,
        color: lastLine.color,
        strokeWidth: lastLine.strokeWidth,
    };

    console.log("Saving line to DB:", lineDataToSave);

    try {
        const { error: insertError } = await supabase
            .from('board_lines')
            .insert({
                board_id: board.id,
                line_data: lineDataToSave,
            });

        if (insertError) throw insertError;

        console.log("Line saved successfully.");
        // Note: Realtime should add the line back with an ID.
        // If duplicates appear, we might need more robust handling in the subscription callback.

    } catch (err: any) {
        console.error("Error saving line:", err);
        setError(prev => prev ? `${prev}\nFailed to save drawing.` : 'Failed to save drawing.');
    }
  }, [board, lines]); // Depend on board and lines

  // --- Konva Event Handlers (wrapped in useCallback) ---
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    setLines((prevLines) => [
      ...prevLines,
      { points: [pos.x, pos.y], tool, color: strokeColor, strokeWidth },
    ]);
  }, [tool, strokeColor, strokeWidth]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getRelativePointerPosition();
    if (!point) return;
    // Update state immutably
    setLines((prevLines) => {
      const lastLine = prevLines[prevLines.length - 1];
      // Ensure lastLine exists before creating a new object
      if (lastLine?.points) { // Check points specifically
        // Create a new line object with the updated points array
        const updatedLine = {
          ...lastLine,
          points: lastLine.points.concat([point.x, point.y]),
        };
        return [...prevLines.slice(0, -1), updatedLine]; // Replace last line with updated one
      }
      return prevLines; // Should not happen if drawing started correctly
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing.current) return; // Only save if we were actually drawing
    isDrawing.current = false;
    saveLineToDb(); // Save the completed line
  }, [saveLineToDb]); // Depend on saveLineToDb

  // --- Touch Event Handlers (wrapped in useCallback) ---
  const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const touches = e.evt.touches;
    const stage = e.target.getStage();
    if (!stage) return;

    if (touches.length === 1) {
      isDrawing.current = true;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      setLines((prevLines) => [
        ...prevLines,
        { points: [pos.x, pos.y], tool, color: strokeColor, strokeWidth },
      ]);
    } else if (touches.length >= 2) {
      isDrawing.current = false;
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


  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const touches = e.evt.touches;
    const stage = e.target.getStage();
     if (!stage) return;

    if (touches.length === 1 && isDrawing.current) {
      const point = stage.getRelativePointerPosition();
      if (!point) return;
      // Update state immutably
      setLines((prevLines) => {
        const lastLine = prevLines[prevLines.length - 1];
        // Ensure lastLine exists before creating a new object
        if (lastLine?.points) { // Check points specifically
           // Create a new line object with the updated points array
           const updatedLine = {
             ...lastLine,
             points: lastLine.points.concat([point.x, point.y]),
           };
           return [...prevLines.slice(0, -1), updatedLine]; // Replace last line with updated one
        }
        return prevLines; // Should not happen if drawing started correctly
      });
    } else if (touches.length >= 2 && lastCenter.current) {
       isDrawing.current = false;
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
         lastDist.current = newDist;
         return;
       }

       let scale = stage.scaleX() * (newDist / lastDist.current);
       scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

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
  }, [stageScale]);

  const handleTouchEnd = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const wasDrawing = isDrawing.current; // Check if we were drawing before resetting
    isDrawing.current = false;
    lastDist.current = 0;
    lastCenter.current = null;
    if (wasDrawing) { // Only save if the touch end corresponds to a drawing action
       saveLineToDb();
    }
  }, [saveLineToDb]); // Depend on saveLineToDb

  // --- Share Button Handler ---
  const handleShareClick = useCallback(() => {
    if (board && board.share_link_id) {
      const shareUrl = `${window.location.origin}/share/${board.share_link_id}`;
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          console.log('Share link copied to clipboard:', shareUrl);
          alert('Share link copied to clipboard!');
        })
        .catch(err => {
          console.error('Failed to copy share link:', err);
          alert('Failed to copy share link.');
        });
    } else {
      console.warn('Cannot share: Board data or share link ID is missing.');
      alert('Cannot generate share link.');
    }
  }, [board]);

  // --- Zoom Handler ---
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let direction = e.evt.deltaY > 0 ? -1 : 1;

    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    setStageScale(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStagePos(newPos);

  }, []);

  // --- Zoom Input Handler ---
  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setZoomInputValue(value);

    const percentage = parseFloat(value);
    if (!isNaN(percentage) && percentage > 0) {
      let newScale = percentage / 100;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      const stage = stageRef.current;
      if (!stage) return;

      const center = {
        x: stageSize.width / 2,
        y: stageSize.height / 2,
      };

      const oldScale = stageScale;

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

  // --- Render Logic ---
  let whiteboardContent;
  if (loading) {
    whiteboardContent = <StatusMessage>Loading board...</StatusMessage>;
  } else if (error) {
    whiteboardContent = <StatusMessage isError={true}>{error}</StatusMessage>;
  } else if (board) {
    whiteboardContent = (
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
        onWheel={handleWheel}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
      >
        {/* Grid Layer */}
        <Layer listening={false}>
          {(() => {
            if (!stageSize.width || !stageSize.height) return null;
            const gridSpacing = 20;
            const gridLineColor = '#e0f2f7';
            const gridLineWidth = 0.5;
            const majorGridLineColor = '#b3e5fc';
            const majorGridLineWidth = 1;
            const majorGridInterval = 5;
            const gridLines = [];
            const topLeftX = -stagePos.x / stageScale;
            const topLeftY = -stagePos.y / stageScale;
            const bottomRightX = (-stagePos.x + stageSize.width) / stageScale;
            const bottomRightY = (-stagePos.y + stageSize.height) / stageScale;
            const startXIndex = Math.floor(topLeftX / gridSpacing);
            const endXIndex = Math.ceil(bottomRightX / gridSpacing);
            const startYIndex = Math.floor(topLeftY / gridSpacing);
            const endYIndex = Math.ceil(bottomRightY / gridSpacing);
            for (let i = startXIndex; i <= endXIndex; i++) {
              const isMajor = i % majorGridInterval === 0;
              const x = Math.round(i * gridSpacing) + 0.5;
              gridLines.push(
                <Line key={`v-${i}`} points={[x, topLeftY, x, bottomRightY]} stroke={isMajor ? majorGridLineColor : gridLineColor} strokeWidth={isMajor ? majorGridLineWidth : gridLineWidth} />
              );
            }
            for (let j = startYIndex; j <= endYIndex; j++) {
               const isMajor = j % majorGridInterval === 0;
               const y = Math.round(j * gridSpacing) + 0.5;
               gridLines.push(
                <Line key={`h-${j}`} points={[topLeftX, y, bottomRightX, y]} stroke={isMajor ? majorGridLineColor : gridLineColor} strokeWidth={isMajor ? majorGridLineWidth : gridLineWidth} />
              );
            }
            return gridLines;
          })()}
        </Layer>
        {/* Drawing Layer */}
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={`line-${i}`}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={ line.tool === 'eraser' ? 'destination-out' : 'source-over' }
            />
          ))}
        </Layer>
      </Stage>
    );
  } else {
    whiteboardContent = <StatusMessage>Board details could not be loaded.</StatusMessage>;
  }


  return (
    <BoardPageContainer>
      <TopNavBar>
         <TitleContainer>
           <BoardTitle>{board ? board.name : 'PeachBoard'}</BoardTitle>
           {board && board.share_link_id && (
             <NavButton onClick={handleShareClick} title="Copy Share Link">
               <FaShareAlt />
             </NavButton>
           )}
         </TitleContainer>
        <DashboardLink to="/dashboard">Back to Dashboard</DashboardLink>
      </TopNavBar>
      <ToolBar>
        <label htmlFor="tool-pen">Tool:</label>
        <button id="tool-pen" onClick={() => setTool('pen')} className={tool === 'pen' ? 'active' : ''} title="Pen" > <FaPen /> </button>
        <button id="tool-eraser" onClick={() => setTool('eraser')} className={tool === 'eraser' ? 'active' : ''} title="Eraser" > <FaEraser /> </button>
        <label htmlFor="color-picker">Color:</label>
        <input type="color" id="color-picker" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} disabled={tool === 'eraser'} />
        <label htmlFor="stroke-width">Width:</label>
        <input type="range" id="stroke-width" min="1" max="50" value={strokeWidth} onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))} />
        <span>{strokeWidth}</span>
      </ToolBar>
      <WhiteboardArea ref={containerRef}>
        {whiteboardContent}
         <ZoomControls>
            <label htmlFor="zoom-input">Zoom:</label>
            <input type="number" id="zoom-input" value={zoomInputValue} onChange={handleZoomInputChange} step="10" />
            <span>%</span>
         </ZoomControls>
      </WhiteboardArea>
    </BoardPageContainer>
  );
};

export default BoardPage;