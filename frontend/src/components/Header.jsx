export default function Header({ user }) {
  return (
    <header>
      <h2>Welcome, {user.name}</h2>
      <button onClick={logout}>Logout</button>
    </header>
  );
}
