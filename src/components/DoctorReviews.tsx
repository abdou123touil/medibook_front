import React, { useEffect, useState } from 'react';
import { Star, ThumbsUp, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';

interface Review {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
}

export function DoctorReviews() {
  const { t } = useTranslation();
  const { doctorId } = useParams(); 
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 0, comment: '' });
  useEffect(() => {
    apiFetch(`http://localhost:3000/api/reviews/doctor/${doctorId}`)
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]));
  }, [doctorId]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    apiFetch(`http://localhost:3000/api/reviews/doctor/${doctorId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: newReview.rating,
        comment: newReview.comment,
      }),
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-indigo-600" />
        Avis des patients
      </h2>

      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review._id} className="border-b border-slate-100 pb-6 last:border-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium">{review.patientName}</span>
              </div>
              <span className="text-sm text-slate-500">
                {format(new Date(review.date), 'PP', { locale: fr })}
              </span>
            </div>
            <p className="text-slate-600 mb-3">{review.comment}</p>
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
              <ThumbsUp className="w-4 h-4" />
              <span>Utile ({review.helpful})</span>
            </button>
          </div>
        ))}
      </div>

      {/* Review Form */}
      <form onSubmit={handleSubmitReview} className="mt-6">
        <div className="flex items-center gap-2">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-6 h-6 ${
                i < newReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
              onClick={() => setNewReview({ ...newReview, rating: i + 1 })}
            />
          ))}
        </div>
        <textarea
          className="mt-2 w-full p-2 border border-slate-200 rounded-md"
          placeholder={t('yourReview')}
          value={newReview.comment}
          onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
        />
        <button type="submit" className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-md">
          {t('submitReview')}
        </button>
      </form>
    </div>
  );
}
