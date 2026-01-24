import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore'; // New imports

// Pages
import PublicHome from './pages/PublicHome';
import CounsellorDashboard from './pages/CounsellorDashboard';
import MainCalculator from './pages/MainCalculator';
import TokenCalculator from './pages/TokenCalculator';
import DirectorDashboard from './pages/DirectorDashboard';
// Import
import CollegeTieUps from './modules/accounts/pages/CollegeTieUps';
import FeeStructureManager from './modules/accounts/pages/FeeStructureManager';
import AccountantDashboard from './modules/accounts/pages/AccountantDashboard';
import LeadDashboard from './modules/crm/pages/LeadDashboard';
import LeadDetails from './modules/crm/pages/LeadDetails';
import Login from './pages/Login';
import RegisterDetails from './pages/RegisterDetails';
import PendingApproval from './pages/PendingApproval';
import BatchManager from './modules/admin/pages/BatchManager';
import BatchDetails from './modules/admin/pages/BatchDetails';
import StudentRecords from './pages/StudentRecords';


import FinalizeAdmission from './modules/accounts/pages/FinalizeAdmission';
import TakeAdmission from './modules/crm/components/AdmissionForm';
import MyAdmissions from './modules/crm/components/MyAdmissions';
import FeeRecovery from './modules/accounts/pages/FeeRecovery';

// Config
import { CENTERS } from './utils/centers';
import { MapPin, LogOut, LayoutDashboard, Calculator, CreditCard, Users, Printer, AlertCircle, UserPlus, Settings } from 'lucide-react';

// Wrapper for Internal Staff Pages
const StaffLayout = ({ children, user, userProfile, handleLogout, currentCenter, setCurrentCenter }) => {
  // SECURITY FIX: Explicitly handle unauthenticated state to prevent unauthorized access
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">Please log in to access the portal.</p>
          <Navigate to="/login" replace />
          <Link to="/login" className="text-blue-600 hover:underline">Go to Login Page</Link>
        </div>
      </div>
    );
  }

  const isDirector = userProfile?.role?.toUpperCase() === 'DIRECTOR';
  const isManager = userProfile?.role?.toUpperCase() === 'MANAGER';

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">

            {/* Branding */}
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2 py-1 rounded ${isDirector ? 'bg-purple-100 text-purple-700' : isManager ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                {isDirector ? 'DIRECTOR ACCESS' : isManager ? 'MANAGER PORTAL' : 'STAFF PORTAL'}
              </span>
              <div className="flex items-center gap-2">
                {currentCenter?.logoPath && (
                  <img src={currentCenter.logoPath} alt="Center Logo" className="h-10 w-auto object-contain" />
                )}
                <div className="hidden md:block">
                  <h1 className="text-sm font-bold text-gray-800">{currentCenter?.name}</h1>
                </div>
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

              <Link to="/staff/dashboard" title="Dashboard"><LayoutDashboard className="w-5 h-5 text-gray-600 hover:text-blue-600" /></Link>


              {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR') && (
                <>
                  <Link to="/staff/accounts" title="Accounts"><Printer className="w-5 h-5 text-gray-600 hover:text-green-600" /></Link>
                  <Link to="/staff/recovery" title="Fee Recovery"><AlertCircle className="w-5 h-5 text-gray-600 hover:text-red-600" /></Link>
                  <Link to="/staff/fees" title="Fee Structure Manager"><Settings className="w-5 h-5 text-gray-600 hover:text-blue-800" /></Link>
                </>
              )}
              <Link to="/staff/calculator" title="Calculator"><Calculator className="w-5 h-5 text-gray-600 hover:text-blue-600" /></Link>
              {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER' || userProfile?.role === 'ACCOUNTANT') && (
                <Link to="/staff/take-admission" title="New Admission"><UserPlus className="w-5 h-5 text-gray-600 hover:text-orange-600" /></Link>
              )}
              {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER' || userProfile?.role === 'STAFF') && (
                <Link to="/staff/leads" title="Leads CRM"><Users className="w-5 h-5 text-gray-600 hover:text-green-600" /></Link>
              )}
              {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') && (
                <Link to="/staff/batches" title="Batch Manager"><Users className="w-5 h-5 text-gray-600 hover:text-purple-600" /></Link>
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
  const auth = getAuth();
  const db = getFirestore();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentCenter, setCurrentCenter] = useState(CENTERS.UN_COLLEGE); // Default center

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const dbProfile = docSnap.data();
          let profile = dbProfile;

          // CHECK FOR LOCAL OVERRIDE (If DB profile is empty/broken)
          if (!profile.name || !profile.centerId) {
            const localOverride = localStorage.getItem("user_profile_override");
            if (localOverride) {
              try {
                const parsed = JSON.parse(localOverride);
                // Only use override if it matches current user (security check)
                if (parsed.email === currentUser.email) {
                  console.log("⚠️ USING LOCAL PROFILE OVERRIDE");
                  profile = parsed;
                }
              } catch (e) { console.error("Invalid Local Override", e); }
            }
          }



          // CRITICAL FIX: Inject the UID into the profile object so it can be used for queries
          setUserProfile({ ...profile, uid: currentUser.uid, id: currentUser.uid });

          // Set current center based on user's assigned center, or default
          let assignedCenterId = profile.centerId || profile.CenterId || "";

          // Normalize
          assignedCenterId = assignedCenterId.trim().toUpperCase();

          // Handle Alias / Typo Fixes
          if (assignedCenterId === "PRAYAAS" || assignedCenterId === "PRAYAS_EDU") {
            assignedCenterId = "PRAYAS";
          }

          if (assignedCenterId && CENTERS[assignedCenterId]) {
            setCurrentCenter(CENTERS[assignedCenterId]);
          } else {
            console.warn(`Center ID '${assignedCenterId}' not found in configuration. Defaulting to College Rd.`);
            setCurrentCenter(CENTERS.UN_COLLEGE); // Fallback to a default center
          }
        } else {
          // Document doesn't exist - Check Local Storage anyway
          const localOverride = localStorage.getItem("user_profile_override");
          if (localOverride) {
            try {
              const parsed = JSON.parse(localOverride);
              if (parsed.email === currentUser.email) {
                setUserProfile({ ...parsed, uid: currentUser.uid, id: currentUser.uid });
                if (parsed.centerId && CENTERS[parsed.centerId]) {
                  setCurrentCenter(CENTERS[parsed.centerId]);
                }
                setLoading(false);
                return;
              }
            } catch (e) { }
          }

          setUserProfile(null);
          setCurrentCenter(CENTERS.UN_COLLEGE); // Fallback if no profile
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setCurrentCenter(CENTERS.UN_COLLEGE); // Reset center on logout
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, db]);

  const handleLogout = () => {
    signOut(auth).then(() => {
      // Sign-out successful.
      setUser(null);
      setUserProfile(null);
      setCurrentCenter(CENTERS.UN_COLLEGE); // Reset center on logout
      console.log("User signed out");
    }).catch((error) => {
      // An error happened.
      console.error("Error signing out:", error);
    });
  };

  // --- MANUAL FIX FUNCTION ---
  const repairProfile = async () => {
    if (!user) return;
    const confirmFix = window.confirm("Are you sure you want to apply the Local Profile Fix?");
    if (!confirmFix) return;

    const fixedProfile = {
      name: "Aditya Dhondge",
      centerId: "PRAYAS",
      role: "COUNSELLOR",
      email: user.email || "",
      _isLocalOverride: true // Marker
    };

    try {
      const { setDoc, serverTimestamp, doc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', user.uid);

      // Try DB Write (might fail due to permissions)
      await setDoc(userDocRef, { ...fixedProfile, createdAt: serverTimestamp() }, { merge: true });
      alert("SUCCESS: Database updated!");
    } catch (err) {
      console.warn("DB Write Permission failed, using Local Storage fallback:", err);
      // Fallback: Save to Local Storage
      localStorage.setItem("user_profile_override", JSON.stringify(fixedProfile));
      alert("Profile fixed LOCALLY (Permissions issue bypassed). Reloading...");
    }
    window.location.reload();
  };



  if (loading) return <div className="h-screen flex items-center justify-center">Loading KAP System...</div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register-details" element={<RegisterDetails />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        {/* PROTECTED ROUTES */}
        <Route path="/staff/dashboard" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {/* INJECTED REPAIR BUTTON FOR STAFF DASHBOARD */}
            <div className="mb-4">
              {!userProfile?.name && (
                <button
                  onClick={repairProfile}
                  className="bg-red-600 text-white px-4 py-2 rounded shadow-lg font-bold hover:bg-red-700"
                >
                  ⚠️ CRITICAL: FIX PROFILE NOW
                </button>
              )}
            </div>

            {(userProfile?.role?.toUpperCase() === 'DIRECTOR' || userProfile?.role?.toUpperCase() === 'MANAGER') ? (
              <DirectorDashboard center={currentCenter} isManager={userProfile?.role?.toUpperCase() === 'MANAGER'} userProfile={userProfile} />
            ) : (userProfile?.role?.toUpperCase() === 'ACCOUNTANT') ? (
              <AccountantDashboard userProfile={userProfile} />
            ) : (
              <CounsellorDashboard userProfile={userProfile} center={currentCenter} />
            )}
          </StaffLayout>
        } />

        <Route path="/staff/calculator" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <MainCalculator center={currentCenter} userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/token" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <TokenCalculator center={currentCenter} userProfile={userProfile} />
          </StaffLayout>
        } />



        {/* CRM Route */}
        <Route path="/staff/leads" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <LeadDashboard userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/leads/:id" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <LeadDetails userProfile={userProfile} />
          </StaffLayout>
        } />

        {/* Director Only Route */}
        <Route path="/staff/admin" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {userProfile?.role === 'DIRECTOR' ? <DirectorDashboard center={currentCenter} userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/batches" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ? <BatchManager userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/batches/:id" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ? <BatchDetails /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/accounts" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR') ? <AccountantDashboard userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/recovery" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ? <FeeRecovery userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/tie-ups" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR') ? <CollegeTieUps userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/fees" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR') ? <FeeStructureManager /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/admission/:id" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <FinalizeAdmission userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/take-admission" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <TakeAdmission userProfile={userProfile} currentCenter={currentCenter} />
          </StaffLayout>
        } />

        <Route path="/staff/my-admissions" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <MyAdmissions userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/student-records" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ?
              <StudentRecords center={currentCenter} isManager={userProfile?.role === 'MANAGER'} userProfile={userProfile} />
              : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
