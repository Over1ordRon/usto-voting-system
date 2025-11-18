import { useEffect, useState } from "react";
import Header from "../components/Header";
import PollCard from "../components/PollCard";
import CreatePollForm from "../components/CreatePollForm";
import { getActivePolls, addVote, createPoll, deletePoll } from "../services/pollService";
import { useAuth } from "../hooks/useAuth";

export default function VotingSystem() {
  const { user, isAdmin, signOut } = useAuth();
  const [polls, setPolls] = useState([]);
  const [votedPolls, setVoted] = useState(new Set());
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (user) loadPolls();
  }, [user]);

  const loadPolls = async () => {
    const data = await getActivePolls();
    setPolls(data);
  };

  const doVote = async (pollId, optionId) => {
    const hash = await sha(user.sub);
    await addVote(pollId, optionId, hash);
    setVoted(new Set([...votedPolls, pollId]));
    loadPolls();
  };

  const sha = async (s) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  };

  const doCreate = async (question, options) => {
    const clean = options.filter((x) => x.trim());
    await createPoll(question, clean, user.email);
    setShowCreate(false);
    loadPolls();
  };

  const doDelete = async (id) => {
    await deletePoll(id);
    loadPolls();
  };

  if (!user) return <div className="p-4 text-center">Please sign in...</div>;

  return (
    <>
      <Header user={user} isAdmin={isAdmin} onLogout={signOut} />

      <div className="max-w-3xl mx-auto p-4">
        {isAdmin && (
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded mb-4"
            onClick={() => setShowCreate(true)}
          >
            + Create Poll
          </button>
        )}

        {showCreate && (
          <CreatePollForm
            onCreate={doCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}

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
    </>
  );
}
