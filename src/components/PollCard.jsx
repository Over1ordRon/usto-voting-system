export default function PollCard({ poll, hasVoted, onVote, isAdmin, onDelete }) {
  const total = poll.options.reduce((a, b) => a + b.votes, 0);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">{poll.question}</h3>

        {isAdmin && (
          <button className="text-red-600" onClick={() => onDelete(poll.id)}>
            Delete
          </button>
        )}
      </div>

      {poll.options.map((opt) => {
        const percent = total ? ((opt.votes / total) * 100).toFixed(1) : 0;

        return (
          <div key={opt.id} className="mb-2">
            {!hasVoted ? (
              <button
                className="w-full border px-4 py-2 rounded hover:bg-indigo-50 text-left"
                onClick={() => onVote(opt.id)}
              >
                {opt.text}
              </button>
            ) : (
              <div className="border rounded p-2 relative bg-gray-50">
                <div className="flex justify-between">
                  <span>{opt.text}</span>
                  <span>{percent}%</span>
                </div>
                <div
                  className="bg-indigo-200 h-2 mt-1 rounded"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
