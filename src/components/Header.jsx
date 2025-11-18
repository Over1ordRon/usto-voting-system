export default function Header({ user, isAdmin, onLogout }) {
  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">USTO Voting</h1>

      {user && (
        <div className="flex items-center gap-4">
          <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-gray-500">{isAdmin ? "Admin" : "Voter"}</p>
          </div>

          <button className="text-red-600" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
