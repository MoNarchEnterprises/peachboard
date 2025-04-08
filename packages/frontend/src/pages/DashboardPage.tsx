import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import styled from 'styled-components';
import { nanoid } from 'nanoid';
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
        {!fetchLoading && !fetchError && (
          boards.length === 0 ? (
            <p>You haven't created any boards yet.</p>
          ) : (
            <BoardList>
              {boards.map((board) => (
                <BoardListItem key={board.id}>
                   {/* Simplified: Just the link to the board */}
                   <BoardLink to={`/board/${board.id}`}>
                     {board.name}
                   </BoardLink>
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
// Removed BoardItemContent, ShareLinkContainer, ShareLinkInput, CopyButton

const BoardLink = styled(Link)`
  display: block; /* Make link take full width of list item */
  padding: 15px 20px; /* Add padding back to the link */
  text-decoration: none;
  color: #333;
  font-size: 1.2em;
  font-weight: 500;

  &:hover {
    color: #D2691E; // Match login link hover
  }
`;