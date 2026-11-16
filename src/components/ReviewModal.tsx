import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  Star,
  MessageCircle,
  X,
  ThumbsUp,
  Heart,
  ThumbsDown,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';

interface Review {
  _id: string;
  patientName: string;
  rating: number;
  comment: string;
  date: string;
  helpful?: number;
  reactions?: { [key: string]: number };
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
}

export function ReviewModal({ isOpen, onClose, doctorId }: ReviewModalProps) {
  const { t, i18n } = useTranslation();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 0, comment: "" });
  const [loading, setLoading] = useState<boolean>(false);
  const [reactionCounts, setReactionCounts] = useState<
    Record<string, Record<string, number>>
  >({});

  // Fetch reviews when modal is opened
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    if (!isAuthenticated) {
      toast.error(t('loginToViewReviews'));
      setLoading(false);
      return;
    }

    
    apiFetch(`http://localhost:3000/api/reviews/doctor/${doctorId}`, {
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then(async (data) => {
        
        setReviews(data);

        if (data.length === 0) {
          setLoading(false);
          return;
        }

        const fetchedReactions: Record<string, Record<string, number>> = {};

        

        setReactionCounts(fetchedReactions);
        setLoading(false);
      })
      .catch((error) => {
        
        toast.error(t('reviewsLoadError'));
        setLoading(false);
      });
  }, [isOpen, doctorId, t, isAuthenticated]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = currentUser;
    if (!isAuthenticated) {
      toast.error(t('loginToSubmitReview'));
      return;
    }

    if (newReview.rating < 1 || newReview.rating > 5) {
      toast.error(t('ratingRangeError'));
      return;
    }

    if (!newReview.comment.trim()) {
      toast.error(t('reviewCommentRequired'));
      return;
    }

    try {
      
      const response = await apiFetch(
        `http://localhost:3000/api/reviews/doctor/${doctorId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rating: newReview.rating,
            comment: newReview.comment,
          }),
        }
      );

      
      if (!response.ok) {
        const errorText = await response.text();
        
        throw new Error(`Failed to submit review: ${errorText}`);
      }

      const addedReview = await response.json();
      
      setReviews((prevReviews) => [addedReview, ...prevReviews]);
      setNewReview({ rating: 0, comment: "" });
      toast.success(t('reviewSubmitted'));
    } catch (error) {
      
      toast.error(t('reviewSubmitError'));
    }
  };

  const fetchReactions = async (reviewId: string) => {
    try {
      const response = await apiFetch(
        `http://localhost:3000/api/reactions/review/${reviewId}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch reactions");

      const data = await response.json();
      setReactionCounts((prev) => ({
        ...prev,
        [reviewId]: data[reviewId] || {},
      }));
    } catch (error) {
      
    }
  };

  const handleReaction = async (reviewId: string, reaction: string) => {
    const userId = currentUser?.data?.id;
    if (!userId || !isAuthenticated) {
      toast.error(t('loginToReact'));
      return;
    }

    try {
      const currentReactionResponse = await apiFetch(
        `http://localhost:3000/api/reactions/user-reaction?userId=${userId}&reviewId=${reviewId}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!currentReactionResponse.ok) throw new Error("Failed to fetch current reaction");
      const currentReactionData = await currentReactionResponse.json();
      const currentReaction = currentReactionData.reaction;

      let requestMethod = "POST";
      let requestUrl = "http://localhost:3000/api/reactions/react";
      let bodyData = { userId, reviewId, type: reaction };

      if (currentReaction === reaction) {
        requestMethod = "POST"; // Toggle off
      } else if (currentReaction) {
        requestMethod = "PUT";
        requestUrl = "http://localhost:3000/api/reactions/update-reaction";
        bodyData = { userId, reviewId, newType: reaction };
      }

      const response = await apiFetch(requestUrl, {
        method: requestMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) throw new Error("Failed to update reaction");

      await fetchReactions(reviewId);
      toast.success(t('reactionUpdated'));
    } catch (error) {
      
      toast.error(t('reactionUpdateError'));
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-500 dark:bg-slate-950 bg-opacity-75 flex justify-center items-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed inset-0 bg-slate-500 dark:bg-slate-950 bg-opacity-75 flex justify-center items-center"
      >
        <div className="fixed inset-0 bg-black dark:bg-slate-950 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-black rounded-xl shadow-lg p-6 w-96 relative">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-slate-500 hover:text-slate-700"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-indigo-600" />
              {t('patientReviews')}
            </h2>

            <div className="space-y-4 max-h-[300px] overflow-y-scroll scrollbar-hide">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-6 bg-gray-300 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : Array.isArray(reviews) && reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review._id} className="border-b pb-4 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? "text-yellow-400 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-medium">
                          {review.patientName}
                        </span>
                      </div>
                      <span className="text-sm text-slate-500">
                        {format(new Date(review.date), "PP", { locale: i18n.language.startsWith('ar') ? undefined : i18n.language.startsWith('en') ? undefined : fr })}
                      </span>
                    </div>

                    <p className="text-slate-600">{review.comment}</p>

                    <div className="flex gap-4 mt-3">
                      {["like", "heart", "dislike"].map((reaction) => {
                        const count = reactionCounts[review._id]?.[reaction] || 0;
                        return (
                          <motion.div
                            key={reaction}
                            className="flex items-center gap-1 cursor-pointer"
                            whileHover={{ scale: 1.2 }}
                            onClick={() => handleReaction(review._id, reaction)}
                          >
                            {reaction === "like" && (
                              <ThumbsUp className="w-6 h-6 text-slate-500" />
                            )}
                            {reaction === "heart" && (
                              <Heart className="w-6 h-6 text-red-500" />
                            )}
                            {reaction === "dislike" && (
                              <ThumbsDown className="w-6 h-6 text-yellow-500" />
                            )}
                            <span className="text-slate-700 font-medium">
                              {count}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">{t('noDoctorReviews')}</p>
              )}
            </div>

            <form onSubmit={handleSubmitReview} className="mt-4">
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-6 h-6 ${
                      i < newReview.rating
                        ? "text-yellow-400 fill-current"
                        : "text-gray-300"
                    }`}
                    onClick={() =>
                      setNewReview({ ...newReview, rating: i + 1 })
                    }
                  />
                ))}
              </div>
              <textarea
                className="mt-2 w-full p-2 border dark:bg-slate-950 border-slate-200 rounded-md"
                placeholder={t('yourReview')}
                value={newReview.comment}
                onChange={(e) =>
                  setNewReview({ ...newReview, comment: e.target.value })
                }
              />
              <button
                type="submit"
                className="mt-3 w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700"
              >
                {t('addReview')}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
