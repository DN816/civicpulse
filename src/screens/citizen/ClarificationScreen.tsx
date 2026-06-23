import React, { useEffect, useState } from 'react';
import { HelpCircle, ChevronRight, Loader2 } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';

interface ClarificationScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function ClarificationScreen({ reportId, onNavigate }: ClarificationScreenProps) {
  const [question, setQuestion] = useState('We need more details to classify this issue.');
  const [options, setOptions] = useState<string[]>(['Yes', 'No']);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (snap.exists()) {
          const rawQuestion = snap.data().clarification_question;
          if (rawQuestion) {
            // Parse "Question? / Option1 / Option2"
            const parts = rawQuestion.split('/').map((s: string) => s.trim());
            if (parts.length > 1) {
              setQuestion(parts[0]);
              setOptions(parts.slice(1).filter((o: string) => o.length > 0));
            } else {
              setQuestion(rawQuestion);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch clarification question", e);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  const handleSelectOption = async (answer: string) => {
    setSubmitting(true);
    try {
      const snap = await getDoc(doc(db, 'reports', reportId));
      const currentDesc = snap.data()?.description || '';
      
      // We append the answer so the AI has context if it runs again
      const newDesc = currentDesc 
        ? `${currentDesc}\n[Clarification: ${answer}]`
        : `[Clarification: ${answer}]`;

      await updateDoc(doc(db, 'reports', reportId), {
        clarification_answer: answer,
        description: newDesc,
        status: 'NEW' // Reset status so CF1 can re-process
      });
      
      onNavigate('submission-pending', reportId);
    } catch (e) {
      console.error("Failed to submit clarification", e);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 text-zinc-900 font-sans p-6">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full space-y-8">
        
        <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center">
          <HelpCircle className="h-10 w-10 text-amber-500" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            More Info Needed
          </h2>
          <p className="text-zinc-500 font-medium text-lg leading-snug">
            {question}
          </p>
        </div>
        
        <div className="w-full space-y-3 pt-4">
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectOption(opt)}
              disabled={submitting}
              className="w-full flex items-center justify-between bg-white border border-zinc-200 text-zinc-800 p-5 rounded-2xl font-semibold hover:border-blue-400 hover:shadow-sm transition disabled:opacity-50"
            >
              <span>{opt}</span>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
