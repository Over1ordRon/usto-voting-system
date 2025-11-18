export default function Header({ user, isAdmin, onLogout }) {
  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-indigo-600">USTO Voting</h1>
        <p className="text-xs text-gray-500">University of Science and Technology</p>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <img 
            src={user.picture} 
            alt={user.name} 
            className="w-10 h-10 rounded-full border-2 border-gray-200" 
          />
          <div>
            <p className="font-semibold text-gray-800">{user.name}</p>
            <p className="text-sm text-gray-500">
              {isAdmin ? (
                <span className="text-indigo-600 font-medium">Admin</span>
              ) : (
                <span>Voter</span>
              )}
            </p>
          </div>

          <button 
            className="text-red-600 hover:text-red-800 font-medium ml-4 px-4 py-2 border border-red-200 rounded hover:bg-red-50 transition-colors"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}