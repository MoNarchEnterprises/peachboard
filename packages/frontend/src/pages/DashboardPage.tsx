import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import styled from 'styled-components';
import { nanoid } from 'nanoid';
import { FaTrash, FaPencilAlt } from 'react-icons/fa'; // Import icons
import logo from '../assets/logoonly.png'; // Import the logo

// Define an interface for the board object
interface Board {
  id: string;
  created_at: string;
  name: string;
  owner_id: string;
  share_link_id: string | null; // Assuming share_link_id can be null
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [newBoardName, setNewBoardName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Error for creating boards
  const [boards, setBoards] = useState<Board[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Track loading state for delete/rename actions (board id)
  const [actionError, setActionError] = useState<string | null>(null); // Error for delete/rename actions
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null); // Track which board is being renamed
  const [renameValue, setRenameValue] = useState<string>(''); // Input value for renaming

  // Function to fetch boards for the current user
  const fetchBoards = async (currentUserId: string) => {
    setFetchLoading(true);
    setFetchError(null);
    try {
      const { data, error: selectError } = await supabase
        .from('peachboards')
        .select('*')
        .eq('owner_id', currentUserId)
        .order('created_at', { ascending: false }); // Order by creation date

      if (selectError) {
        throw selectError;
      }

      setBoards(data || []);
    } catch (err: any) {
      console.error('Error fetching boards:', err);
      setFetchError(`Failed to fetch boards: ${err.message || 'Unknown error'}`);
      setBoards([]); // Clear boards on error
    } finally {
      setFetchLoading(false);
    }
  };

  // Get user ID and fetch initial boards
  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        console.log("Fetched User ID:", user.id);
        fetchBoards(user.id); // Fetch boards after getting user ID
      } else {
        console.error("No user logged in, redirecting to login.");
        navigate('/login');
      }
    };
    initialize();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    } else {
      // Navigation should be handled by the listener in LoginPage,
      // but we can force it here to ensure redirection.
      navigate('/login');
    }
  };

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      setError('Board name cannot be empty.');
      return;
    }
    if (!userId) {
      setError('User not identified. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate a unique share_link_id using nanoid
      const uniqueShareId = nanoid(10); // Generate a 10-character unique ID

      const { data, error: insertError } = await supabase
        .from('peachboards')
        .insert([
          { name: newBoardName.trim(), owner_id: userId, share_link_id: uniqueShareId }
        ])
        .select(); // Select to potentially get the created board data back

      if (insertError) {
        throw insertError;
      }

      console.log('Board created:', data);
      setNewBoardName(''); // Clear input field
      if (userId) {
        fetchBoards(userId); // Refresh the list after creating a new board
      }
    } catch (err: any) {
      console.error('Error creating board:', err);
      setError(`Failed to create board: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    if (!window.confirm(`Are you sure you want to delete the board "${boardName}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(boardId); // Set loading state for this specific board
    setActionError(null);

    try {
      const { error: deleteError } = await supabase
        .from('peachboards')
        .delete()
        .match({ id: boardId });

      if (deleteError) {
        throw deleteError;
      }

      console.log(`Board ${boardId} deleted successfully.`);
      // Refresh the list by filtering out the deleted board locally
      // or re-fetching if preferred (re-fetching is simpler here)
      if (userId) {
        fetchBoards(userId);
      }
    } catch (err: any) {
      console.error('Error deleting board:', err);
      setActionError(`Failed to delete board: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null); // Clear loading state
    }
  };

  const handleStartRename = (boardId: string, currentName: string) => {
    setRenamingBoardId(boardId);
    setRenameValue(currentName);
    setActionError(null); // Clear previous errors
  };

  const handleCancelRename = () => {
    setRenamingBoardId(null);
    setRenameValue('');
  };

  const handleConfirmRename = async () => {
    if (!renamingBoardId || !renameValue.trim()) {
      setActionError('Board name cannot be empty.');
      return;
    }
    if (renameValue.trim().length > 100) { // Optional: Add length validation
        setActionError('Board name cannot exceed 100 characters.');
        return;
    }


    setActionLoading(renamingBoardId); // Use the same loading state, indicate action on this board
    setActionError(null);

    try {
      const { error: updateError } = await supabase
        .from('peachboards')
        .update({ name: renameValue.trim() })
        .match({ id: renamingBoardId });

      if (updateError) {
        throw updateError;
      }

      console.log(`Board ${renamingBoardId} renamed successfully.`);
      setRenamingBoardId(null); // Exit rename mode
      setRenameValue('');
      if (userId) {
        fetchBoards(userId); // Refresh the list
      }
    } catch (err: any) {
      console.error('Error renaming board:', err);
      setActionError(`Failed to rename board: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null); // Clear loading state
    }
  };

  return (
    <DashboardContainer>
      <DashboardHeader>
        {/* Title container with logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logo} alt="PeachBoard Logo" style={{ height: '45px', width: 'auto' }} /> {/* Increased height by 50% */}
          <h1 style={{ margin: 0 }}>Tutor Dashboard</h1>
        </div>
        <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
      </DashboardHeader>

      <CreateBoardSection>
        <SectionTitle>Create New PeachBoard</SectionTitle>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <CreateBoardForm>
          <BoardNameInput
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="Enter board name (e.g., Algebra - Student Name)"
            disabled={loading}
          />
          <CreateBoardButton onClick={handleCreateBoard} disabled={loading || !newBoardName.trim()}>
            {loading ? 'Creating...' : 'Create Board'}
          </CreateBoardButton>
        </CreateBoardForm>
      </CreateBoardSection>

      <YourBoardsSection>
        <SectionTitle>Your PeachBoards</SectionTitle>
        {fetchLoading && <p>Loading boards...</p>}
        {fetchError && <ErrorMessage>{fetchError}</ErrorMessage>}
        {actionError && <ErrorMessage>{actionError}</ErrorMessage>} {/* Display action errors */}
        {!fetchLoading && !fetchError && (
          boards.length === 0 ? (
            <p>You haven't created any boards yet.</p>
          ) : (
            <BoardList>
              {boards.map((board) => (
                <BoardListItem key={board.id}>
                  <> {/* Add explicit fragment */}
                    {renamingBoardId === board.id ? (
                    // Renaming UI
                    <BoardItemContent>
                      <RenameInput
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()} // Allow Enter to save
                        disabled={actionLoading === board.id}
                      />
                      <BoardActions>
                        <ActionButton
                          onClick={handleConfirmRename}
                          disabled={actionLoading === board.id || !renameValue.trim()}
                          title="Save Name"
                          style={{ backgroundColor: '#e8f5e9', borderColor: '#c8e6c9', color: '#388e3c' }} // Greenish save button
                        >
                          {actionLoading === board.id ? 'Saving...' : 'Save'}
                        </ActionButton>
                        <ActionButton
                          onClick={handleCancelRename}
                          disabled={actionLoading === board.id}
                          title="Cancel Rename"
                        >
                          Cancel
                        </ActionButton>
                      </BoardActions>
                    </BoardItemContent>
                  ) : (
                    // Default Display UI
                    <BoardItemContent>
                      <BoardLink to={`/board/${board.id}`} title={board.name}> {/* Add title for long names */}
                        {board.name}
                      </BoardLink>
                      <BoardActions>
                        <ActionButton
                          onClick={() => handleStartRename(board.id, board.name)}
                          disabled={!!renamingBoardId || actionLoading === board.id} // Disable if another rename is active or action is loading
                          title="Rename Board"
                        >
                          <FaPencilAlt />
                        </ActionButton>
                        <ActionButton
                          onClick={() => handleDeleteBoard(board.id, board.name)}
                          disabled={!!renamingBoardId || actionLoading === board.id} // Disable if rename is active or action is loading
                          title="Delete Board"
                        >
                          {actionLoading === board.id ? '...' : <FaTrash />}
                        </ActionButton>
                     </BoardActions>
                   </BoardItemContent>
                   )}
                 </> {/* Close explicit fragment */}
                </BoardListItem>
              ))}
            </BoardList>
          )
        )}
      </YourBoardsSection>
    </DashboardContainer>
  );
};

export default DashboardPage;

// Styled Components - Updated Colors
const DashboardContainer = styled.div`
  padding: 30px; // Increased padding
  max-width: 900px; // Limit width
  margin: 40px auto; // Center container
`;

const DashboardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const LogoutButton = styled.button`
  padding: 8px 15px;
  background-color: #FFE5B4; // Peach background
  color: #A0522D; // Darker brown text
  border: 1px solid #ffdab0; // Lighter peach border
  border-radius: 8px; // Match other buttons
  cursor: pointer;
`;

const CreateBoardSection = styled.div`
  margin-bottom: 30px;
  padding: 25px;
  border: 1px solid #FFDAB9; // Peach border
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); // Slightly softer shadow
  background: #FFF8DC; // Cornsilk background (like login messages)
`;

const SectionTitle = styled.h2`
  margin-bottom: 20px;
  color: #8B4513; // SaddleBrown title
`;

const CreateBoardForm = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const BoardNameInput = styled.input`
  padding: 12px 14px;
  flex-grow: 1;
  border-radius: 8px;
  border: 1px solid #FFDAB9; // Peach border
  font-size: 16px;
  transition: border-color 0.2s;

  &:focus {
    border-color: #FFA07A; // Darker peach focus
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 160, 122, 0.2); // Subtle focus ring
  }
`;

const CreateBoardButton = styled.button`
  padding: 12px 20px;
  background: #FFDAB9; // Peach background
  color: #444; // Darker text
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;

  &:hover {
    background: #FFA07A; // Darker peach hover
  }

  &:disabled {
    background: #ddd;
    color: #888;
    cursor: default;
  }
`;

const ErrorMessage = styled.p`
  color: #D9534F; // Softer red
  background-color: #FADBD8; // Light pink background
  border: 1px solid #F1948A; // Pinkish border
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 15px; // Increased margin
`;

const YourBoardsSection = styled.div`
  margin-top: 40px;
`;

const BoardList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const BoardListItem = styled.li`
  background-color: #fff;
  border: 1px solid #FFDAB9; // Peach border
  border-radius: 8px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04); // Softer shadow
  transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;

  &:hover {
    border-color: #FFA07A; // Darker peach border on hover
    box-shadow: 0 3px 8px rgba(0,0,0,0.08);
  }
`;

// Style for the rename input field
const RenameInput = styled.input`
 padding: 8px 10px;
 flex-grow: 1;
 margin-right: 10px;
 border-radius: 5px;
 border: 1px solid #ccc;
 font-size: 1.1em; /* Slightly larger to match link */

  &:focus {
    border-color: #FFA07A; // Darker peach focus
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 160, 122, 0.2); // Subtle focus ring
  }
`;

// Add styles for the content wrapper and actions container
const BoardItemContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px; /* Padding moved here from BoardLink */
`;

const BoardActions = styled.div`
  display: flex;
  gap: 10px;
`;

// Action Button Style for Icons
const ActionButton = styled.button`
  padding: 0; /* Remove padding */
  width: 30px; /* Fixed width */
  height: 30px; /* Fixed height */
  font-size: 1em; /* Adjust icon size if needed */
  border-radius: 5px;
  cursor: pointer;
  display: flex; /* Center icon */
  align-items: center; /* Center icon */
  justify-content: center; /* Center icon */
  background-color: #f8f8f8;
  border: 1px solid #ddd;
  color: #555;
  transition: background-color 0.2s, border-color 0.2s;

  &:hover:not(:disabled) {
    background-color: #eee;
    border-color: #ccc;
  }

  &:disabled {
    background-color: #eee;
    color: #aaa;
    cursor: not-allowed;
  }

  /* Specific styling for delete button */
  &[title="Delete Board"]:not(:disabled) {
     background-color: #fff0f0;
     border-color: #fcc;
     color: #d9534f;
  }
   &[title="Delete Board"]:hover:not(:disabled) {
     background-color: #fadde1;
     border-color: #f9bdbb;
   }

   /* Specific styling for rename button */
    &[title="Rename Board"]:not(:disabled) {
      background-color: #f0f4ff; /* Light blue background */
      border-color: #cce;
      color: #4a69bd; /* Blue icon */
    }
    &[title="Rename Board"]:hover:not(:disabled) {
      background-color: #e1e8ff;
      border-color: #bbc;
    }

    /* Styling for Save and Cancel buttons during rename */
    &[title="Save Name"] {
        /* Already styled inline, but could add hover here */
    }
     &[title="Cancel Rename"]:not(:disabled) {
        background-color: #f5f5f5;
        border-color: #ddd;
        color: #777;
     }
     &[title="Cancel Rename"]:hover:not(:disabled) {
        background-color: #eee;
        border-color: #ccc;
     }
`;

const BoardLink = styled(Link)`
  /* display: block; */ /* No longer needed as padding is on parent */
  /* padding: 15px 20px; */ /* Padding moved to BoardItemContent */
  flex-grow: 1; /* Allow link to take available space */
  margin-right: 15px; /* Add some space between link and buttons */
  text-decoration: none;
  color: #333;
  font-size: 1.2em;
  font-weight: 500;

  &:hover {
    color: #D2691E; // Match login link hover
  }
`;