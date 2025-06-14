import React, { useState, useMemo } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "moderator";
  status: "active" | "inactive";
  lastLogin: string;
}

interface DashboardProps {
  users: User[];
  theme: "light" | "dark";
}

const Dashboard: React.FC<DashboardProps> = ({ users, theme }) => {
  const [selectedView, setSelectedView] = useState<"grid" | "list">("grid");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = filterRole === "all" || user.role === filterRole;
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [users, filterRole, searchTerm]);

  const roleClasses = {
    admin: "bg-red-100 text-red-800 border-red-200",
    moderator: "bg-yellow-100 text-yellow-800 border-yellow-200",
    user: "bg-green-100 text-green-800 border-green-200",
  };

  const statusClasses = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    inactive: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-50 shadow-lg border-b backdrop-blur-sm ${
          theme === "dark"
            ? "bg-gray-800/95 border-gray-700"
            : "bg-white/95 border-gray-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              User Dashboard
            </h1>

            {/* Theme Toggle */}
            <button
              onClick={() => setShowNotification(true)}
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                theme === "dark"
                  ? "bg-gray-700 hover:bg-gray-600 focus:ring-blue-500"
                  : "bg-gray-100 hover:bg-gray-200 focus:ring-blue-500"
              }`}
            >
              <span className="sr-only">Toggle theme</span>
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </header>

      {/* Notification */}
      {showNotification && (
        <div className="fixed top-20 right-4 z-50 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-slide-in-right">
          <div className="flex items-center space-x-2">
            <span>✓</span>
            <span>Theme toggled successfully!</span>
            <button
              onClick={() => setShowNotification(false)}
              className="ml-2 text-white hover:text-gray-200 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div
          className={`mb-8 p-6 rounded-xl shadow-sm border ${
            theme === "dark"
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <label htmlFor="search" className="sr-only">
                Search users
              </label>
              <div className="relative">
                <input
                  id="search"
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === "dark"
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-4">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className={`px-4 py-3 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === "dark"
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-gray-50 border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="user">User</option>
              </select>

              {/* View Toggle */}
              <div
                className={`flex rounded-lg border-2 overflow-hidden ${
                  theme === "dark" ? "border-gray-600" : "border-gray-300"
                }`}
              >
                <button
                  onClick={() => setSelectedView("grid")}
                  className={`px-4 py-3 transition-colors ${
                    selectedView === "grid"
                      ? "bg-blue-500 text-white"
                      : theme === "dark"
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setSelectedView("list")}
                  className={`px-4 py-3 transition-colors ${
                    selectedView === "list"
                      ? "bg-blue-500 text-white"
                      : theme === "dark"
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-lg">Loading users...</span>
          </div>
        )}

        {/* User Grid/List */}
        {!isLoading && (
          <div
            className={
              selectedView === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }
          >
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`group transform transition-all duration-200 hover:scale-105 hover:shadow-xl ${
                  theme === "dark"
                    ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                } ${
                  selectedView === "grid"
                    ? "rounded-xl border p-6 shadow-sm"
                    : "rounded-lg border p-4 shadow-sm flex items-center space-x-4"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`${selectedView === "grid" ? "mb-4" : ""} flex-shrink-0`}
                >
                  <div
                    className={`${
                      selectedView === "grid"
                        ? "w-16 h-16 mx-auto"
                        : "w-12 h-12"
                    } bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl`}
                  >
                    {user.name.charAt(0)}
                  </div>
                </div>

                {/* Content */}
                <div
                  className={`${selectedView === "grid" ? "text-center" : "flex-1"}`}
                >
                  <h3
                    className={`font-semibold ${selectedView === "grid" ? "text-lg mb-1" : "text-base"}`}
                  >
                    {user.name}
                  </h3>
                  <p
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    } ${selectedView === "grid" ? "mb-3" : "mb-1"}`}
                  >
                    {user.email}
                  </p>

                  {/* Badges */}
                  <div
                    className={`flex ${
                      selectedView === "grid"
                        ? "justify-center"
                        : "justify-start"
                    } space-x-2 mb-2`}
                  >
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleClasses[user.role]}`}
                    >
                      {user.role}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClasses[user.status]}`}
                    >
                      {user.status}
                    </span>
                  </div>

                  <p
                    className={`text-xs ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    Last login: {user.lastLogin}
                  </p>
                </div>

                {/* Actions */}
                {selectedView === "list" && (
                  <div className="flex-shrink-0">
                    <button
                      className={`p-2 rounded-lg transition-colors ${
                        theme === "dark"
                          ? "text-gray-400 hover:text-white hover:bg-gray-700"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      •••
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <div
              className={`text-6xl mb-4 ${
                theme === "dark" ? "text-gray-600" : "text-gray-400"
              }`}
            >
              👥
            </div>
            <h3
              className={`text-lg font-medium mb-2 ${
                theme === "dark" ? "text-gray-300" : "text-gray-900"
              }`}
            >
              No users found
            </h3>
            <p
              className={`${
                theme === "dark" ? "text-gray-500" : "text-gray-600"
              }`}
            >
              Try adjusting your search criteria or filters.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
