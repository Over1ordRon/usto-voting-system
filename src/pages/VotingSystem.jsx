import { useEffect, useState } from "react";
import Header from "../components/Header";
import PollCard from "../components/PollCard";
import CreatePollForm from "../components/CreatePollForm";
import { getActivePolls, addVote, createPoll, deletePoll, checkIfVoted } from "../services/pollService";
import { useAuth } from "../hooks/useAuth";

export default function VotingSystem() {
  const { user, isAdmin, signOut } = useAuth();
  const [polls, setPolls] = useState([]);
  const [votedPolls, setVoted] = useState(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPolls();
    }
  }, [user]);

  const loadPolls = async () => {
    try {
      setLoading(true);
      const data = await getActivePolls();
      setPolls(data);

      // Check which polls the user has already voted on
      const hash = await sha(user.sub);
      const voted = new Set();
      
      for (const poll of data) {
        const hasVoted = await checkIfVoted(poll.id, hash);
        if (hasVoted) {
          voted.add(poll.id);
        }
      }
      
      setVoted(voted);
    } catch (error) {
      console.error("Failed to load polls:", error);
      alert("Failed to load polls. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const sha = async (s) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const doVote = async (pollId, optionId) => {
    try {
      const hash = await sha(user.sub);
      await addVote(pollId, optionId, hash);
      setVoted(new Set([...votedPolls, pollId]));
      await loadPolls();
    } catch (error) {
      console.error("Vote failed:", error);
      alert(error.message || "Failed to submit vote. You may have already voted on this poll.");
    }
  };

  const doCreate = async (question, options) => {
    try {
      await createPoll(question, options, user.email);
      setShowCreate(false);
      await loadPolls();
    } catch (error) {
      console.error("Failed to create poll:", error);
      throw error; // Let the form component handle the error
    }
  };

  const doDelete = async (id) => {
    try {
      await deletePoll(id);
      await loadPolls();
    } catch (error) {
      console.error("Failed to delete poll:", error);
      alert("Failed to delete poll. Please try again.");
    }
  };

  // Login screen with Google Sign-In button
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full mx-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-indigo-600 mb-2">USTO Voting</h1>
            <p className="text-gray-600">University of Science and Technology</p>
          </div>
          
          <div className="mb-6">
            <svg className="w-20 h-20 mx-auto text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          
          <p className="text-gray-700 mb-6 text-lg">
            Sign in with your university email to participate in polls
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">📧 Required:</span> @etu.univ-usto.dz email
            </p>
          </div>
          
          <div className="flex justify-center">
            <div id="g_id_signin"></div>
          </div>
          
          <div id="g_id_onload"
               data-client_id="337975458118-unpg0jnt0jq24h3mlumclknm5dbp09pg.apps.googleusercontent.com"
               data-callback="handleCredentialResponse">
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} onLogout={signOut} />

      <div className="max-w-3xl mx-auto p-4 py-8">
        {isAdmin && (
          <div className="mb-6">
            <button
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-semibold shadow-md transition-colors"
              onClick={() => setShowCreate(true)}
            >
              + Create New Poll
            </button>
          </div>
        )}

        {showCreate && (
          <CreatePollForm
            onCreate={doCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading polls...</p>
          </div>
        ) : polls.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Active Polls</h3>
            <p className="text-gray-500">
              {isAdmin 
                ? "Create your first poll to get started!" 
                : "Check back later for new polls."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                isAdmin={isAdmin}
                onDelete={doDelete}
                hasVoted={votedPolls.has(poll.id)}
                onVote={(optionId) => doVote(poll.id, optionId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}