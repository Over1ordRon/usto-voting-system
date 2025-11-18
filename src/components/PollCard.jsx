import { useState } from "react";

export default function PollCard({ poll, hasVoted, onVote, isAdmin, onDelete }) {
  const [loading, setLoading] = useState(false);
  const total = poll.options.reduce((a, b) => a + b.votes, 0);

  const handleVote = async (optionId) => {
    try {
      setLoading(true);
      await onVote(optionId);
    } catch (error) {
      console.error('Vote failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await onDelete(poll.id);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete poll. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold flex-1">{poll.question}</h3>

        {isAdmin && (
          <button 
            className="text-red-600 hover:text-red-800 ml-4 disabled:opacity-50"
            onClick={handleDelete}
            disabled={loading}
          >
            Delete
          </button>
        )}
      </div>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const percent = total ? ((opt.votes / total) * 100).toFixed(1) : 0;

          return (
            <div key={opt.id}>
              {!hasVoted ? (
                <button
                  className="w-full border px-4 py-3 rounded hover:bg-indigo-50 hover:border-indigo-500 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleVote(opt.id)}
                  disabled={loading}
                >
                  {opt.text}
                </button>
              ) : (
                <div className="border rounded p-3 relative bg-gray-50">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">{opt.text}</span>
                    <span className="font-semibold text-indigo-600">{percent}%</span>
                  </div>
                  <div className="bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {opt.votes} {opt.votes === 1 ? 'vote' : 'votes'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasVoted && (
        <div className="mt-4 text-sm text-gray-600 border-t pt-3">
          Total votes: {total}
        </div>
      )}
    </div>
  );
}