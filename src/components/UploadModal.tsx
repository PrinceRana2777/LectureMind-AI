import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, FileAudio, FileVideo, AlertCircle, CheckCircle2, Youtube, Link as LinkIcon } from 'lucide-react';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { processLecture, processYouTubeLecture, getYouTubeId } from '../services/geminiService';
import { cn } from '../lib/utils';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function UploadModal({ isOpen, onClose, userId }: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch YouTube title
  React.useEffect(() => {
    const fetchTitle = async () => {
      const videoId = getYouTubeId(youtubeUrl);
      if (videoId && activeTab === 'youtube') {
        setIsFetchingTitle(true);
        try {
          // Using YouTube's oEmbed endpoint
          const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
          if (response.ok) {
            const data = await response.json();
            if (data.title && !title) {
              setTitle(data.title);
            }
          }
        } catch (err) {
          console.error('Failed to fetch YouTube title:', err);
        } finally {
          setIsFetchingTitle(false);
        }
      }
    };

    const timer = setTimeout(fetchTitle, 500);
    return () => clearTimeout(timer);
  }, [youtubeUrl, activeTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size exceeds 100MB limit');
        return;
      }
      setFile(selectedFile);
      setError(null);
      if (!title) setTitle(selectedFile.name.split('.')[0]);
    }
  };

  const handleUpload = async () => {
    if (activeTab === 'file' && (!file || !title)) return;
    if (activeTab === 'youtube' && (!youtubeUrl || !title)) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Create initial lecture doc
      const lectureRef = await addDoc(collection(db, 'lectures'), {
        userId,
        title,
        status: 'processing',
        sourceType: activeTab,
        createdAt: serverTimestamp(),
        subject: 'General'
      });

      // 2. Process with Gemini
      let processedData;
      if (activeTab === 'file' && file) {
        processedData = await processLecture(file, title);
        processedData.sourceType = 'file';
      } else {
        const videoId = getYouTubeId(youtubeUrl);
        if (!videoId) throw new Error('Invalid YouTube URL');
        processedData = await processYouTubeLecture(youtubeUrl, title);
      }

      // 3. Update doc with results
      await updateDoc(doc(db, 'lectures', lectureRef.id), processedData);

      onClose();
      resetForm();
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process lecture. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setYoutubeUrl('');
    setTitle('');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-[#141414] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Add New Lecture</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all">
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/5 p-1 rounded-2xl mb-8">
            <button 
              onClick={() => setActiveTab('file')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all",
                activeTab === 'file' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
              )}
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
            <button 
              onClick={() => setActiveTab('youtube')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all",
                activeTab === 'youtube' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
              )}
            >
              <Youtube className="w-4 h-4" />
              YouTube Link
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Lecture Title</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Newton's Laws of Motion"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                {isFetchingTitle && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"
                    />
                  </div>
                )}
              </div>
            </div>

            {activeTab === 'file' ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all",
                  file ? "border-indigo-500/50 bg-indigo-500/5" : "border-white/10 hover:border-white/20 bg-white/5"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="audio/*,video/*"
                  className="hidden"
                />
                
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
                      {file.type.startsWith('video') ? <FileVideo className="text-indigo-400 w-8 h-8" /> : <FileAudio className="text-indigo-400 w-8 h-8" />}
                    </div>
                    <p className="font-semibold text-indigo-200 mb-1">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                      <Upload className="text-gray-500 w-8 h-8" />
                    </div>
                    <p className="font-semibold mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Audio or Video (Max 100MB)</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">YouTube URL</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input 
                    type="text" 
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                </div>
                {youtubeUrl && getYouTubeId(youtubeUrl) && (
                  <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10">
                    <img 
                      src={`https://img.youtube.com/vi/${getYouTubeId(youtubeUrl)}/maxresdefault.jpg`} 
                      className="w-full h-full object-cover"
                      alt="Thumbnail Preview"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-4 rounded-2xl text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button 
              disabled={isUploading || (activeTab === 'file' ? !file : !youtubeUrl) || !title}
              onClick={handleUpload}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3",
                isUploading ? "bg-indigo-600/50 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-500/20"
              )}
            >
              {isUploading ? (
                <>
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  Processing with AI...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Start Processing
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
