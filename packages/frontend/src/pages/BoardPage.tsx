import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js'; // Import type
import { Stage, Layer, Line, Rect, Circle } from 'react-konva';
import Konva from 'konva';
import { FaPen, FaEraser, FaShareAlt, FaSquare, FaCircle } from 'react-icons/fa'; // Import Square icon (used for Rect & Circle for now)


// Define an interface for the board object
interface Board {
  id: string;
  created_at: string;
  name: string;
  owner_id: string;
  share_link_id: string | null;
}

type Tool = 'pen' | 'rectangle' | 'circle' | 'eraser'; // Add 'circle'

// Base interface for all drawing elements on the PeachBoard
interface BoardElementBase {
  id?: string;
  tool: Tool;
  color: string;
  strokeWidth: number;
  creator_id?: string | null;
}

// Interface for line data stored in DB and state
interface LineElement extends BoardElementBase {
  tool: 'pen' | 'eraser';
  points: number[];
}

// Interface for the rect data stored in DB and state
interface RectangleElement extends BoardElementBase {
  tool: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

// Interface for Circle elements
interface CircleElement extends BoardElementBase {
  tool: 'circle';
  x: number; // Center x
  y: number; // Center y
  radius: number;
}

type BoardElement = LineElement | RectangleElement | CircleElement; 

// Interface for the raw DB row
interface BoardElementRow {
  id: string;
  board_id: string;
  creator_id: string | null;
  element_data: Omit<LineElement, 'id' | 'creator_id'> | Omit<RectangleElement, 'id' | 'creator_id'> | Omit<CircleElement, 'id' | 'creator_id'>; 
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

const StatusMessage = styled.p<{ $isError?: boolean }>` // Prefix prop with $
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: ${props => props.$isError ? 'red' : '#555'}; // Use $isError in style logic
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
  const [elements, setElements] = useState<BoardElement[]>([]); // Use LineData interface
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false); // Ref to track panning state
  const panStartPoint = useRef<{ x: number; y: number } | null>(null); // Ref for pan start coords
  const drawingStartPoint = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [zoomInputValue, setZoomInputValue] = useState('100');

  // Tool state
  const [tool, setTool] = useState<'pen' | 'rectangle' | 'circle' | 'eraser'>('pen');
  const [strokeColor, setStrokeColor] = useState('#df4b26');
  const [strokeWidth, setStrokeWidth] = useState(5);

  // --- Function to fetch initial elements ---
  const fetchInitialElements = useCallback(async (currentBoardId: string) => { // Wrap in useCallback
    console.log("Fetching initial elements for board:", currentBoardId);
    try {
      const { data, error: selectError } = await supabase
        .from('board_lines')
        .select('id, creator_id, element_data') 
        .eq('board_id', currentBoardId);

      if (selectError) throw selectError;

      const initialElements: BoardElement[] = (data || [])
        .map((row: any): BoardElement | null => {
          const elementData = row.element_data; 
          if (elementData && typeof elementData === 'object') {
             if (elementData.tool && elementData.color && elementData.strokeWidth) {
                const baseElement = {
                  id: row.id,
                  creator_id: row.creator_id,
                  tool: elementData.tool,
                  color: elementData.color,
                  strokeWidth: elementData.strokeWidth,
                };
                if ((elementData.tool === 'pen' || elementData.tool === 'eraser') && Array.isArray(elementData.points) && elementData.points.length > 0) {
                  return { ...baseElement, tool: elementData.tool, points: elementData.points };
                } else if (elementData.tool === 'rectangle' && typeof elementData.x === 'number') {
                  return { ...baseElement, tool: 'rectangle', x: elementData.x, y: elementData.y, width: elementData.width ?? 0, height: elementData.height ?? 0 };
                } else if (elementData.tool === 'circle' && typeof elementData.x === 'number'){
                  return { ...baseElement, tool: 'circle', x: elementData.x, y: elementData.y, radius: elementData.radius ?? 0};
                }
             }
          }
          console.warn("Skipping invalid element data from DB:", row);
          return null;
        })
        .filter((element): element is BoardElement => element !== null);

      console.log("Fetched initial elements:", initialElements);
      setElements(initialElements);

    } catch (err: any) {
      console.error("Error fetching initial elements:", err);
      setError(prev => prev ? `${prev}\nFailed to fetch elements.` : 'Failed to fetch elements.');
    }
  }, []); // Empty dependency array for fetchInitialLines

  // --- Fetch Board Details Effect ---
  useEffect(() => {
    const fetchBoardDetails = async () => {
      setLoading(true);
      setError(null);
      setBoard(null);
      setElements([]); // Clear lines when fetching new board

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
          fetchInitialElements(data.id);
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
  }, [boardId, shareLinkId, fetchInitialElements]); // Add fetchIntitialElements to dependency array

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
        .on<BoardElementRow>(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'board_lines',
            filter: `board_id=eq.${currentBoardId}`,
          },
          (payload) => {
            console.log('Realtime INSERT received:', payload);
            const newElementRecord = payload.new; // This is now correctly typed as BoardElementRow | undefined
            const elementData = newElementRecord?.element_data; 
            // Check if the record and its element_data exist and are objects
            if (elementData && typeof elementData === 'object') {
               // Construct the Element object for state
              let newElement: BoardElement | null = null;
              const baseElement = {
                id: newElementRecord.id,
                creator_id: newElementRecord.creator_id ?? undefined,
                tool: elementData.tool,
                color: elementData.color,
                strokeWidth: elementData.strokeWidth,
              };
              // Bring in the lines
              if ((elementData.tool === 'pen' || elementData.tool === 'eraser') && Array.isArray(elementData.points) && elementData.points.length > 0) {
                newElement = { ...baseElement, tool: elementData.tool, points: elementData.points };
              } 
              // Bring in the rectangles
              else if (elementData.tool === 'rectangle' && typeof elementData.x === 'number') {
                newElement = { ...baseElement, tool: 'rectangle', x: elementData.x, y: elementData.y, width: elementData.width ?? 0, height: elementData.height ?? 0 };
              }
              // Bring in the circles
              else if (elementData.tool === 'circle' && typeof elementData.x === 'number'){
                newElement = { ...baseElement, tool: 'circle', x: elementData.x, y: elementData.y, radius: elementData.radius ?? 0};
              }
              
              if (newElement) {
                console.log("Adding element from Realtime:", newElement);
                setElements((prevElements) => {
                  if (!prevElements.some(el => el.id === newElement?.id)) {
                    return [...prevElements, newElement];
                  }
                  console.log("Duplicate element detected, skipping add:", newElement.id);
                  return prevElements;
                });
              } else { console.warn("Received Realtime insert with invalid element data:", payload); }
            } else { console.warn("Received Realtime insert without valid element_data:", payload); }
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

  // --- Function to save the last drawn element ---
  const saveElementToDb = useCallback(async () => { // Make async
    if (!board?.id) return;

    const lastElement = elements[elements.length - 1];
    if (!lastElement) return;

    let elementDataForJsonb: Omit<CircleElement, 'id' | 'creator_id'> | Omit<LineElement, 'id' | 'creator_id'> | Omit<RectangleElement, 'id' | 'creator_id'> | null = null;

    if (lastElement.tool === 'pen' || lastElement.tool === 'eraser') {
       if (!lastElement.points || lastElement.points.length < 4) { console.log("Skipping save for invalid line:", lastElement); return; }
       elementDataForJsonb = { points: lastElement.points, tool: lastElement.tool, color: lastElement.color, strokeWidth: lastElement.strokeWidth };
    } 
    else if (lastElement.tool === 'rectangle') {
       if (!lastElement.width || !lastElement.height || lastElement.width === 0 || lastElement.height === 0) {
          console.log("Skipping save for zero-size rectangle:", lastElement);
          setElements(prev => prev.slice(0, -1)); return;
       }
       const x = lastElement.width < 0 ? lastElement.x + lastElement.width : lastElement.x;
       const y = lastElement.height < 0 ? lastElement.y + lastElement.height : lastElement.y;
       const width = Math.abs(lastElement.width);
       const height = Math.abs(lastElement.height);
       elementDataForJsonb = { x, y, width, height, tool: lastElement.tool, color: lastElement.color, strokeWidth: lastElement.strokeWidth };
    }
    else if (lastElement.tool === 'circle'){
      if (!lastElement.radius || lastElement.radius === 0){
        console.log("Skipping for 0 radius circles", lastElement);
        setElements(prev => prev.slice(0,-1));
        return;
      }
      const x = lastElement.x; 
      const y = lastElement.y;
      const radius = Math.abs(lastElement.radius);
      elementDataForJsonb = {x, y, radius, tool: lastElement.tool, color: lastElement.color, strokeWidth: lastElement.strokeWidth};
    }

    if (!elementDataForJsonb) { console.warn("Could not prepare data for saving element:", lastElement); return; }
    console.log("Saving element to DB:", elementDataForJsonb);
    try {
        // Save to 'element_data' column
        const { error: insertError } = await supabase
            .from('board_lines').insert({ board_id: board.id, element_data: elementDataForJsonb }); // Use element_data
        if (insertError) throw insertError;
        console.log("Element saved successfully.");
    } catch (err: any) { console.error("Error saving element:", err); setError(prev => prev ? `${prev}\nFailed to save element.` : 'Failed to save element.'); }
  }, [board, elements]);

  // --- Konva Event Handlers (wrapped in useCallback) ---
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage(); if (!stage) return;

    // Check mouse button: 0 = left, 1 = middle, 2 = right
    if (e.evt.button === 1) { // Middle mouse button (wheel click) for panning
      isDrawing.current = false; // Ensure not drawing
      isPanning.current = true;
      panStartPoint.current = stage.getPointerPosition(); // Use absolute position
      e.evt.preventDefault(); // Prevent default middle-click actions (like auto-scroll)
    } 
    else if (e.evt.button === 0) { // Left mouse button for drawing
      isPanning.current = false; // Ensure not panning
      isDrawing.current = true;
      const pos = stage.getRelativePointerPosition(); if (!pos) return;
      drawingStartPoint.current = pos;

      if (tool === 'pen' || tool === 'eraser') {
        setElements((prevElements) => [...prevElements, { tool, points: [pos.x, pos.y], color: strokeColor, strokeWidth } as LineElement]);
      } else if (tool === 'rectangle') {
        setElements((prevElements) => [...prevElements, { tool, x: pos.x, y: pos.y, width: 0, height: 0, color: strokeColor, strokeWidth } as RectangleElement]);
      } else if (tool === 'circle') {
        // Add temporary circle
        setElements((prevElements) => [...prevElements, { tool, x: pos.x, y: pos.y, radius: 0, color: strokeColor, strokeWidth } as CircleElement]);
      }
      
    }
  }, [tool, strokeColor, strokeWidth]); // Dependencies for drawing part

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current && !isPanning.current) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getRelativePointerPosition();
    if (!point) return;
    // Update state immutably
    else if (isDrawing.current) {
      setElements((prevElements) => {
        const currentElement = prevElements[prevElements.length - 1];
        if (!currentElement) return prevElements;

        if (currentElement.tool === 'pen' || currentElement.tool === 'eraser') {
          const updatedElement = { ...currentElement, points: currentElement.points.concat([point.x, point.y]) };
          return [...prevElements.slice(0, -1), updatedElement];
        } else if (currentElement.tool === 'rectangle' && drawingStartPoint.current) {
          const updatedElement = {
            ...currentElement,
            width: point.x - drawingStartPoint.current.x,
            height: point.y - drawingStartPoint.current.y,
          };
          return [...prevElements.slice(0, -1), updatedElement];
        } else if (currentElement.tool === 'circle' && drawingStartPoint.current) {
           // Update temporary circle radius
           const dx = point.x - drawingStartPoint.current.x; // Use point here
           const dy = point.y - drawingStartPoint.current.y; // Use point here
           const radius = Math.sqrt(dx * dx + dy * dy);
           const updatedElement = { ...currentElement, radius };
           return [...prevElements.slice(0, -1), updatedElement];
        }
        
        return prevElements;
      });
    }
    else if(isPanning.current && panStartPoint.current){
      const dx = point.x - panStartPoint.current.x;
      const dy = point.y - panStartPoint.current.y;
      const newPos ={
        x: point.x - (point.x - stage.x() - dx),
        y: point.y - (point.y - stage.y() - dy),
      }
      setStagePos(newPos);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if(!isDrawing.current && !isPanning.current) return; 
    if (isDrawing.current){
      isDrawing.current = false;
      saveElementToDb(); // Only save if we were actually drawing
    }
    else if (isPanning.current){
      isPanning.current = false;
    }
  }, [saveElementToDb]); // Depend on saveLineToDb

  // --- Touch Event Handlers (wrapped in useCallback) ---
  const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault(); const touches = e.evt.touches; const stage = e.target.getStage(); if (!stage) return;
    if (touches.length === 1) {
      isPanning.current = false; isDrawing.current = true;
      const pos = stage.getRelativePointerPosition(); if (!pos) return;
      drawingStartPoint.current = pos;
      if (tool === 'pen' || tool === 'eraser') {
        setElements((prevElements) => [...prevElements, { tool, points: [pos.x, pos.y], color: strokeColor, strokeWidth: strokeWidth } as LineElement]);
      } else if (tool === 'rectangle') {
        setElements((prevElements) => [...prevElements, { tool, x: pos.x, y: pos.y, width: 0, height: 0, color: strokeColor, strokeWidth: strokeWidth } as RectangleElement]);
      } else if (tool === 'circle'){
        setElements((prevElements) => [...prevElements, { tool, x: pos.x, y: pos.y, radius: 0, color: strokeColor, strokeWidth: strokeWidth} as CircleElement]);
      }
    } else if (touches.length >= 2) {
      isDrawing.current = false; isPanning.current = true;
      const touch1 = touches[0]; const touch2 = touches[1];
      lastDist.current = getDistance({ x: touch1.clientX, y: touch1.clientY }, { x: touch2.clientX, y: touch2.clientY });
      lastCenter.current = getCenter({ x: touch1.clientX, y: touch1.clientY }, { x: touch2.clientX, y: touch2.clientY });
      panStartPoint.current = lastCenter.current;
    }
  }, [tool, strokeColor, strokeWidth]);


  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault(); const touches = e.evt.touches; const stage = e.target.getStage(); if (!stage) return;
    if (touches.length === 1 && isDrawing.current) {
      const pos = stage.getRelativePointerPosition(); if (!pos) return;
      setElements((prevElements) => {
        const currentElement = prevElements[prevElements.length - 1];
        if (!currentElement) return prevElements;
        if (currentElement.tool === 'pen' || currentElement.tool === 'eraser') {
          const updatedElement = { ...currentElement, points: currentElement.points.concat([pos.x, pos.y]) };
          return [...prevElements.slice(0, -1), updatedElement];
        } else if (currentElement.tool === 'rectangle' && drawingStartPoint.current) {
          const updatedElement = { ...currentElement, width: pos.x - drawingStartPoint.current.x, height: pos.y - drawingStartPoint.current.y };
          return [...prevElements.slice(0, -1), updatedElement];
        } else if (currentElement.tool === 'circle' && drawingStartPoint.current){
          const updatedElement = { ...currentElement, radius: getDistance(drawingStartPoint.current, pos)};
          return [...prevElements.slice(0,-1), updatedElement];
        } else if (currentElement.tool === 'circle' && drawingStartPoint.current) { // Add circle logic here
           const dx = pos.x - drawingStartPoint.current.x;
           const dy = pos.y - drawingStartPoint.current.y;
           const radius = Math.sqrt(dx * dx + dy * dy);
           const updatedElement = { ...currentElement, radius };
           return [...prevElements.slice(0, -1), updatedElement];
        }
        return prevElements;
      });
    } else if (touches.length >= 2 && isPanning.current && panStartPoint.current) {
       const touch1 = touches[0]; const touch2 = touches[1];
       const newCenter = getCenter({ x: touch1.clientX, y: touch1.clientY }, { x: touch2.clientX, y: touch2.clientY });
       const newDist = getDistance({ x: touch1.clientX, y: touch1.clientY }, { x: touch2.clientX, y: touch2.clientY });
       const dx = newCenter.x - panStartPoint.current.x;
       const dy = newCenter.y - panStartPoint.current.y;
       let newPos = { x: stagePos.x + dx, y: stagePos.y + dy };
       let newScale = stageScale;
       if (lastDist.current > 0) {
         const scaleChange = newDist / lastDist.current;
         newScale = stageScale * scaleChange;
         newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
         const mousePointTo = { x: (newCenter.x - newPos.x) / stageScale, y: (newCenter.y - newPos.y) / stageScale };
         newPos = { x: newCenter.x - mousePointTo.x * newScale, y: newCenter.y - mousePointTo.y * newScale };
       }
       setStageScale(newScale); setStagePos(newPos);
       lastDist.current = newDist; panStartPoint.current = newCenter;
    }
  }, [stageScale, stagePos]);

  const handleTouchEnd = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const wasDrawing = isDrawing.current; // Check if we were drawing before resetting
    isDrawing.current = false;
    lastDist.current = 0;
    lastCenter.current = null;
    if (wasDrawing) { // Only save if the touch end corresponds to a drawing action
       saveElementToDb();
    }
  }, [saveElementToDb]); // Depend on saveElementToDb

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
    whiteboardContent = <StatusMessage $isError={true}>{error}</StatusMessage>;
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
          {elements.map((element, i) => {
            // Basic validation for all elements
            if (!element || typeof element.tool !== 'string' || typeof element.color !== 'string' || typeof element.strokeWidth !== 'number') {
              console.warn("Skipping render for element with invalid base properties:", element);
              return null;
            }

            if (element.tool === 'pen' || element.tool === 'eraser') {
              // Line validation
              if (!Array.isArray(element.points) || element.points.length < 2 || element.points.some(isNaN)) {
                 console.warn("Skipping render for invalid line element:", element);
                 return null;
              }
              return (
                <Line
                  key={element.id ?? `line-${i}`}
                  points={element.points}
                  stroke={element.color}
                  strokeWidth={element.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={ element.tool === 'eraser' ? 'destination-out' : 'source-over' }
                />
              );
            } else if (element.tool === 'rectangle') {
              // Rectangle validation
              if (
                typeof element.x !== 'number' || isNaN(element.x) ||
                typeof element.y !== 'number' || isNaN(element.y) ||
                typeof element.width !== 'number' || isNaN(element.width) ||
                typeof element.height !== 'number' || isNaN(element.height) ||
                element.width === 0 || element.height === 0 // Also skip zero-size
              ) {
                 console.warn("Skipping render for invalid rectangle element:", element);
                 return null;
              }
              // Render Rect (adjusting for negative width/height)
              return (
                <Rect
                  key={element.id ?? `rect-${i}`}
                  x={element.width < 0 ? element.x + element.width : element.x}
                  y={element.height < 0 ? element.y + element.height : element.y}
                  width={Math.abs(element.width)}
                  height={Math.abs(element.height)}
                  stroke={element.color} strokeWidth={element.strokeWidth}
                />
              ); // Directly return the Rect component
            } else if (element.tool === 'circle'){
              if (
                typeof element.x !== 'number' || isNaN(element.x) ||
                typeof element.y !== 'number' || isNaN(element.y) ||
                typeof element.radius != 'number' || isNaN(element.radius) || element.radius === 0
              ){
                console.warn("Skipping render for invalid circle element:", element);
                return null;
              }
              return(
                <Circle
                  key={element.id ?? `circle-${i}`}
                  x={element.x}
                  y={element.y}
                  radius={element.radius}
                  stroke={element.color}
                  strokeWidth={element.strokeWidth}
                />
              );
            }
            return null;
          })}
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
        <button id="tool-rectangle" onClick={() => setTool('rectangle')} className={tool === 'rectangle'?'active':''} title="Rectangle"><FaSquare /></button>
        {/* Using FaSquare as placeholder for Circle */}
        <button id="tool-circle" onClick={() => setTool('circle')} className={tool === 'circle' ? 'active' : ''} title="Circle" > <FaCircle /> </button>
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