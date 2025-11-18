import { useState } from "react";

export default function CreatePollForm({ onCreate, onCancel }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);

  const addOption = () => setOptions([...options, ""]);
  
  const updateOption = (i, v) => {
    const copy = [...options];
    copy[i] = v;
    setOptions(copy);
  };
  
  const removeOption = (i) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, x) => x !== i));
  };

  const handleCreate = async () => {
    // Validation
    if (!question.trim()) {
      alert('Please enter a poll question');
      return;
    }
    
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) {
      alert('Please provide at least 2 valid options');
      return;
    }

    try {
      setLoading(true);
      await onCreate(question, options);
    } catch (error) {
      console.error('Failed to create poll:', error);
      alert('Failed to create poll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow mb-6">
      <h2 className="text-xl font-bold mb-4">Create New Poll</h2>

      <input
        className="border w-full mb-4 p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Poll question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        disabled={loading}
      />

      <div className="mb-4">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">Options</label>
        {options.map((op, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              className="border flex-1 p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={`Option ${i + 1}`}
              value={op}
              onChange={(e) => updateOption(i, e.target.value)}
              disabled={loading}
            />
            {options.length > 2 && (
              <button 
                className="text-red-600 hover:text-red-800 px-3"
                onClick={() => removeOption(i)}
                disabled={loading}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <button 
        className="text-indigo-600 hover:text-indigo-800 mb-4 font-semibold"
        onClick={addOption}
        disabled={loading}
      >
        + Add Option
      </button>

      <div className="flex gap-2">
        <button
          className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Poll'}
        </button>
        <button 
          className="bg-gray-300 px-6 py-2 rounded hover:bg-gray-400 disabled:opacity-50"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}