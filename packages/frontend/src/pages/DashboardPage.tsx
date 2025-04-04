import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import styled from 'styled-components';
import { nanoid } from 'nanoid'; // Import nanoid

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
        <h1>Tutor Dashboard</h1>
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
                  <BoardLink to={`/board/${board.id}`}>
                    {board.name}
                  </BoardLink>
                  {/* Optional: Add delete button or other actions here */}
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

// Styled Components
const DashboardContainer = styled.div`
  padding: 20px;
`;

const DashboardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const LogoutButton = styled.button`
  padding: 8px 15px;
  background-color: #f0f0f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;

const CreateBoardSection = styled.div`
  margin-bottom: 30px;
  padding: 25px;
  border: 1px solid #eee;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  background: #f9f9f9;
`;

const SectionTitle = styled.h2`
  margin-bottom: 20px;
  color: #333;
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
  border: 1px solid #ccc;
  font-size: 16px;
  transition: border-color 0.2s;

  &:focus {
    border-color: #98FB98;
    outline: none;
  }
`;

const CreateBoardButton = styled.button`
  padding: 12px 20px;
  background: #98FB98;
  color: #333;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;

  &:hover {
    background: #76c876;
  }

  &:disabled {
    background: #ddd;
    color: #888;
    cursor: default;
  }
`;

const ErrorMessage = styled.p`
  color: red;
  margin-bottom: 10px;
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
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  transition: box-shadow 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 3px 8px rgba(0,0,0,0.06);
  }
`;

const BoardLink = styled(Link)`
  display: block;
  padding: 15px 20px;
  text-decoration: none;
  color: #333;
  font-size: 16px;

  &:hover {
    color: #007bff; // Or your theme's link hover color
  }
`;