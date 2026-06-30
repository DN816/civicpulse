import React, { useEffect, useState } from 'react';
import { HelpCircle, ChevronRight, Loader2 } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';
import Toast, { ToastType } from '../../components/ui/Toast';

interface ClarificationScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function ClarificationScreen({ reportId, onNavigate }: ClarificationScreenProps) {
  const [question, setQuestion] = useState('We need more details to classify this issue.');
  const [options, setOptions] = useState<string[]>(['Yes', 'No']);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (snap.exists()) {
          const rawQuestion = snap.data().clarification_question;
          if (rawQuestion) {
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
        setToast({ message: 'Could not load clarification question.', type: 'error' });
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
      
      const newDesc = currentDesc 
        ? `${currentDesc}\n[Clarification: ${answer}]`
        : `[Clarification: ${answer}]`;

      await updateDoc(doc(db, 'reports', reportId), {
        clarification_answer: answer,
        description: newDesc,
        status: 'NEW'
      });
      
      onNavigate('submission-pending', reportId);
    } catch (e) {
      setToast({ message: 'Failed to submit clarification. Please try again.', type: 'error' });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary font-sans p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full space-y-8">
        
        <div className="h-20 w-20 bg-status-warning/10 rounded-full flex items-center justify-center">
          <HelpCircle className="h-10 w-10 text-status-warning" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-screen-title text-text-primary">
            More Info Needed
          </h2>
          <p className="text-body-lg text-text-secondary font-medium leading-snug">
            {question}
          </p>
        </div>
        
        <div className="w-full space-y-3 pt-4">
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectOption(opt)}
              disabled={submitting}
              className="w-full flex items-center justify-between bg-surface border border-border text-text-primary p-5 rounded-xl font-semibold hover:border-primary/50 hover:shadow-sm transition disabled:opacity-50"
            >
              <span>{opt}</span>
              <ChevronRight className="h-5 w-5 text-text-secondary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
