export default function CreatePollForm({ onCreate, onCancel }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

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

  return (
    <div className="bg-white rounded-xl p-6 shadow mb-6">
      <h2 className="text-xl font-bold mb-4">Create Poll</h2>

      <input
        className="border w-full mb-4 p-2 rounded"
        placeholder="Poll question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      {options.map((op, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input
            className="border flex-1 p-2 rounded"
            value={op}
            onChange={(e) => updateOption(i, e.target.value)}
          />
          {options.length > 2 && (
            <button className="text-red-600" onClick={() => removeOption(i)}>
              Remove
            </button>
          )}
        </div>
      ))}

      <button className="text-indigo-600 mb-4" onClick={addOption}>
        + Add Option
      </button>

      <div className="flex gap-2">
        <button
          className="bg-indigo-600 text-white px-4 py-2 rounded"
          onClick={() => onCreate(question, options)}
        >
          Create
        </button>
        <button className="bg-gray-300 px-4 py-2 rounded" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
