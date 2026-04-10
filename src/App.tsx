import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Lecture, UserProfile } from './types';
import { 
  BookOpen, 
  Upload, 
  FileText, 
  Zap, 
  HelpCircle, 
  LogOut, 
  Search,
  Plus,
  Clock,
  ChevronRight,
  BrainCircuit,
  GraduationCap,
  Youtube,
  AlertCircle,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Components
import UploadModal from './components/UploadModal';
import LectureView from './components/LectureView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState<'lectures' | 'flashcards' | 'quizzes'>('lectures');
  const [activeFilter, setActiveFilter] = useState('All');
  const [initError, setInitError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    let unsubLectures: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          // Ensure user profile exists
          const userRef = doc(db, 'users', user.uid);
          try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: serverTimestamp()
              });
            }
          } catch (err) {
            console.error('Error checking/creating user profile:', err);
            // We don't block the whole app if profile creation fails, 
            // but we should log it.
          }

          // Listen for lectures
          const q = query(
            collection(db, 'lectures'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );

          unsubLectures = onSnapshot(q, (snapshot) => {
            const fetchedLectures = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Lecture[];
            setLectures(fetchedLectures);
            setLoading(false);
          }, (err) => {
            console.error('Firestore snapshot error:', err);
            setInitError('Failed to load lectures. Please check your permissions.');
            setLoading(false);
          });
        } else {
          setLectures([]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setInitError('Failed to initialize authentication.');
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubLectures) unsubLectures();
    };
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    setInitError(null); // Clear previous errors
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // 1. Get ID Token for backend verification
      const idToken = await user.getIdToken();
      
      // 2. Verify with backend (Production Best Practice)
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        throw new Error('Backend authentication failed. Please check your connection.');
      }

      console.log('Login successful and verified with backend');
      
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log('Login cancelled by user');
      } else {
        console.error('Login failed:', error);
        setInitError(error.message || 'An unexpected error occurred during login.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredLectures = lectures.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         l.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' || l.subject === activeFilter || (activeFilter === 'Maths' && l.subject === 'Mathematics');
    return matchesSearch && matchesFilter;
  });

  const allFlashcards = lectures.flatMap(l => l.flashcards || []);
  const allQuizzes = lectures.flatMap(l => l.quiz || []);

  if (initError) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-red-500/20">
          <AlertCircle className="text-red-500 w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Initialization Error</h1>
        <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
          {initError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
        >
          <RefreshCcw className="w-5 h-5" />
          Try Again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BrainCircuit className="text-white w-10 h-10" />
          </div>
          <span className="text-indigo-200 font-medium tracking-widest uppercase text-xs">LectureMind AI</span>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center z-10"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/40">
            <BrainCircuit className="text-white w-12 h-12" />
          </div>
          <h1 className="text-5xl font-bold mb-4 tracking-tight">LectureMind AI</h1>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            The ultimate AI study companion for JEE & NEET aspirants. 
            Convert lectures into high-yield notes instantly.
          </p>

          {initError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm text-left"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{initError}</p>
            </motion.div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white text-black font-semibold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <RefreshCcw className="w-5 h-5 animate-spin" />
            ) : (
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            )}
            {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
          <p className="mt-8 text-xs text-gray-500 uppercase tracking-widest font-medium">
            Optimized for Physics, Chemistry, Biology & Maths
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 border-r border-white/5 bg-[#0D0D0D] hidden lg:flex flex-col p-6 z-30">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BrainCircuit className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">LectureMind</span>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => { setActivePage('lectures'); setSelectedLecture(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activePage === 'lectures' ? "bg-indigo-600/10 text-indigo-400" : "text-gray-400 hover:bg-white/5"
            )}
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-medium">My Lectures</span>
          </button>
          <button 
            onClick={() => { setActivePage('flashcards'); setSelectedLecture(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activePage === 'flashcards' ? "bg-indigo-600/10 text-indigo-400" : "text-gray-400 hover:bg-white/5"
            )}
          >
            <Zap className="w-5 h-5" />
            <span className="font-medium">Flashcards</span>
          </button>
          <button 
            onClick={() => { setActivePage('quizzes'); setSelectedLecture(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activePage === 'quizzes' ? "bg-indigo-600/10 text-indigo-400" : "text-gray-400 hover:bg-white/5"
            )}
          >
            <GraduationCap className="w-5 h-5" />
            <span className="font-medium">Quizzes</span>
          </button>
        </nav>

        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl mb-4">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border border-white/10" alt={user.displayName || ''} referrerPolicy="no-referrer" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300",
        "lg:ml-72 min-h-screen"
      )}>
        <header className="sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5 z-20 px-6 py-4 flex items-center justify-between">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search lectures, subjects, topics..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="ml-4 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" />
            <span>Upload Lecture</span>
          </button>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {selectedLecture ? (
              <LectureView 
                lecture={selectedLecture} 
                onBack={() => setSelectedLecture(null)} 
              />
            ) : activePage === 'lectures' ? (
              <motion.div 
                key="lectures-page"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-bold tracking-tight">Recent Lectures</h2>
                  <div className="flex gap-2">
                    {['All', 'Physics', 'Chemistry', 'Biology', 'Maths'].map(tag => (
                      <button 
                        key={tag} 
                        onClick={() => setActiveFilter(tag)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                          activeFilter === tag 
                            ? "bg-indigo-600 border-indigo-500 text-white" 
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredLectures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl p-20 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                      <FileText className="text-gray-500 w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">No lectures found</h3>
                    <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                      Start your learning journey by uploading a lecture recording or pasting a YouTube link.
                    </p>
                    <button 
                      onClick={() => setIsUploadModalOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                    >
                      Upload Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredLectures.map((lecture) => (
                      <motion.div 
                        key={lecture.id}
                        layoutId={lecture.id}
                        onClick={() => setSelectedLecture(lecture)}
                        className="group bg-[#141414] border border-white/5 rounded-3xl p-6 hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="text-indigo-400 w-6 h-6" />
                        </div>
                        
                        <div className="mb-6 relative">
                          {lecture.thumbnailUrl ? (
                            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 mb-4">
                              <img src={lecture.thumbnailUrl} className="w-full h-full object-cover" alt={lecture.title} referrerPolicy="no-referrer" />
                              {lecture.sourceType === 'youtube' && (
                                <div className="absolute top-2 right-2 bg-red-600 p-1.5 rounded-lg">
                                  <Youtube className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg",
                              lecture.subject === 'Physics' ? "bg-blue-500/20 text-blue-400" :
                              lecture.subject === 'Chemistry' ? "bg-orange-500/20 text-orange-400" :
                              lecture.subject === 'Biology' ? "bg-green-500/20 text-green-400" :
                              lecture.subject === 'Mathematics' ? "bg-purple-500/20 text-purple-400" :
                              "bg-gray-500/20 text-gray-400"
                            )}>
                              {lecture.subject === 'Physics' ? <Zap className="w-6 h-6" /> :
                               lecture.subject === 'Chemistry' ? <BrainCircuit className="w-6 h-6" /> :
                               lecture.subject === 'Biology' ? <BookOpen className="w-6 h-6" /> :
                               <FileText className="w-6 h-6" />}
                            </div>
                          )}
                        </div>

                        <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors line-clamp-2">{lecture.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {lecture.createdAt?.toDate().toLocaleDateString()}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/5 text-xs font-medium uppercase tracking-wider">
                            {lecture.subject}
                          </span>
                        </div>

                        {lecture.status === 'processing' && (
                          <div className="mt-6 flex items-center gap-2 text-indigo-400 text-sm font-medium">
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full"
                            />
                            AI Processing...
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : activePage === 'flashcards' ? (
              <motion.div 
                key="flashcards-page"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h2 className="text-3xl font-bold mb-8 tracking-tight">All Flashcards</h2>
                {allFlashcards.length === 0 ? (
                  <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <Zap className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">No flashcards generated yet. Upload a lecture to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {allFlashcards.map((card, i) => (
                      <div key={i} className="group h-64 [perspective:1000px]">
                        <div className="relative h-full w-full rounded-3xl transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                          <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#141414] border border-white/5 rounded-3xl [backface-visibility:hidden]">
                            <p className="text-xl font-bold text-center">{card.question}</p>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center p-8 bg-indigo-600 rounded-3xl [transform:rotateY(180deg)] [backface-visibility:hidden]">
                            <p className="text-xl font-bold text-center text-white">{card.answer}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="quizzes-page"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h2 className="text-3xl font-bold mb-8 tracking-tight">Practice Quizzes</h2>
                {allQuizzes.length === 0 ? (
                  <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <GraduationCap className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">No quizzes generated yet. Upload a lecture to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {allQuizzes.map((q, i) => (
                      <div key={i} className="bg-[#141414] border border-white/5 rounded-3xl p-8">
                        <h4 className="text-xl font-bold mb-6 flex gap-4">
                          <span className="text-indigo-400">Q{i+1}.</span>
                          {q.question}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          {q.options.map((opt, j) => (
                            <button 
                              key={j}
                              className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:border-indigo-500/50 transition-all flex items-center justify-between group"
                            >
                              {opt}
                              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        userId={user.uid}
      />
    </div>
  );
}
