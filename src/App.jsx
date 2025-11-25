import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore'; // New imports

// Pages
import PublicHome from './pages/PublicHome';
import MainCalculator from './pages/MainCalculator';
import TokenCalculator from './pages/TokenCalculator';
import DirectorDashboard from './pages/DirectorDashboard';
import LeadManager from './pages/LeadManager'; // WE WILL CREATE THIS NEXT
import Login from './pages/Login';

// Config
import { CENTERS } from './utils/centers';
import { MapPin, LogOut, LayoutDashboard, Calculator, CreditCard, Users } from 'lucide-react';

// Wrapper for Internal Staff Pages
const StaffLayout = ({ children, user, userProfile, handleLogout, currentCenter, setCurrentCenter }) => {
  if (!user) return <Navigate to="/login" />;

  const isDirector = userProfile?.role === 'DIRECTOR';

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">

            {/* Branding */}
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2 py-1 rounded ${isDirector ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {isDirector ? 'DIRECTOR ACCESS' : 'STAFF PORTAL'}
              </span>
              <div className="hidden md:block">
                <h1 className="text-sm font-bold text-gray-800">{currentCenter?.name}</h1>
              </div>
            </div>

            {/* Menu */}
            <div className="flex items-center space-x-2 md:space-x-4">

              {/* CENTER SWITCHER: Only show if DIRECTOR */}
              {isDirector ? (
                <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1 border">
                  <MapPin className="w-4 h-4 text-gray-500 ml-2" />
                  <select
                    value={currentCenter.id}
                    onChange={(e) => setCurrentCenter(CENTERS[e.target.value])}
                    className="bg-transparent border-none text-xs font-bold text-gray-700 cursor-pointer py-1 px-2 outline-none"
                  >
                    <option value="UN_COLLEGE">College Road</option>
                    <option value="UN_NASHIK_RD">Nashik Road</option>
                    <option value="PRAYAS">Prayas Center</option>
                  </select>
                </div>
              ) : (
                // If Staff, just show the icon, no dropdown
                <div className="flex items-center text-gray-500 text-xs font-bold bg-gray-50 px-3 py-1 rounded">
                  <MapPin className="w-3 h-3 mr-1" /> {currentCenter?.name} (Locked)
                </div>
              )}

              <Link to="/staff/calculator" title="Calculator"><Calculator className="w-5 h-5 text-gray-600 hover:text-blue-600" /></Link>
              <Link to="/staff/token" title="Token"><CreditCard className="w-5 h-5 text-gray-600 hover:text-orange-600" /></Link>
              <Link to="/staff/leads" title="Leads CRM"><Users className="w-5 h-5 text-gray-600 hover:text-green-600" /></Link>

              {/* Only Director sees Accounts/Dashboard */}
              {isDirector && (
                <Link to="/staff/admin" title="Admin Dashboard"><LayoutDashboard className="w-5 h-5 text-gray-600 hover:text-purple-600" /></Link>
              )}

              <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 p-2 rounded-full">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>
      <div className="py-10 px-4">
        {children}
      </div>
    </div>
  );
};

function App() {
  const [currentCenter, setCurrentCenter] = useState(CENTERS.UN_COLLEGE);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Stores Role & Center
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Fetch User Profile from Firestore
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data();
          setUserProfile(profile);

          // LOCK THE CENTER IF STAFF
          if (profile.role === 'STAFF' && profile.centerId && CENTERS[profile.centerId]) {
            setCurrentCenter(CENTERS[profile.centerId]);
          }
        } else {
          // Fallback if no profile exists (Treat as Guest Staff)
          setUserProfile({ role: 'STAFF' });
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(getAuth());
    setUserProfile(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading KAP System...</div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />

        {/* PROTECTED ROUTES */}
        <Route path="/staff/calculator" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <MainCalculator center={currentCenter} />
          </StaffLayout>
        } />

        <Route path="/staff/token" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <TokenCalculator center={currentCenter} />
          </StaffLayout>
        } />

        {/* CRM Route */}
        <Route path="/staff/leads" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <LeadManager userProfile={userProfile} />
          </StaffLayout>
        } />

        {/* Director Only Route */}
        <Route path="/staff/admin" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {userProfile?.role === 'DIRECTOR' ? <DirectorDashboard /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
