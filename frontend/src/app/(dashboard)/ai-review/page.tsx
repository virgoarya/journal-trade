"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles, MessageSquare, TrendingUp, AlertTriangle, Lightbulb, Target, Clock, RefreshCw, Loader2 } from "lucide-react";
import { aiReviewService, type AIReview } from "@/services/ai-review.service";
import { tradeService, type Trade } from "@/services/trade.service";

export default function AIReviewPage() {
  const [selectedReview, setSelectedReview] = useState<AIReview | null>(null);
  const [reviews, setReviews] = useState<AIReview[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [reviewsResult, tradesResult] = await Promise.all([
          aiReviewService.getAll(),
          tradeService.getAll(),
        ]);

        if (reviewsResult.success && Array.isArray(reviewsResult.data)) {
          setReviews(reviewsResult.data);
        } else {
          setReviews([]);
        }
        if (tradesResult.success && Array.isArray(tradesResult.data)) {
          setTrades(tradesResult.data);
        } else {
          setTrades([]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRequestReview = async (tradeId: string) => {
    setIsAnalyzing(true);
    try {
      const result = await aiReviewService.generate(tradeId);
      if (result.success && result.data) {
        setReviews(prev => [result.data!, ...prev]);
        setSelectedReview(result.data);
      } else {
        alert(result.error || "Failed to generate review");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-data-profit";
    if (score >= 6) return "text-accent-gold";
    if (score >= 4) return "text-data-warning";
    return "text-data-loss";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return "Exceptional";
    if (score >= 8) return "Excellent";
    if (score >= 7) return "Good";
    if (score >= 6) return "Satisfactory";
    if (score >= 5) return "Needs Work";
    if (score >= 4) return "Poor";
    return "Critical";
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-data-loss font-medium mb-2">Error loading reviews</p>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">AI Review</h1>
          <p className="text-sm text-text-secondary mt-1">Machine-powered analysis of your trades</p>
        </div>
        {trades.length > 0 && (
          <div className="flex space-x-2">
            <select
              onChange={(e) => {
                if (e.target.value) handleRequestReview(e.target.value);
              }}
              defaultValue=""
              className="bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
            >
              <option value="" disabled>Analyze a trade...</option>
              {trades.slice(0, 10).map((trade) => (
                <option key={trade.id} value={trade.id}>
                  {trade.pair} - {trade.type} (${Math.abs(trade.pnl).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Introduction Banner */}
      <div className="glass p-6 border-l-4 border-accent-gold">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-accent-gold/10 rounded-lg">
            <Sparkles className="w-6 h-6 text-accent-gold" />
          </div>
          <div>
            <h3 className="font-semibold text-accent-gold mb-1">How AI Review Works</h3>
            <p className="text-sm text-text-secondary">
              Our AI analyzes your trade entries, exits, journal notes, and psychology to provide personalized feedback.
              It evaluates your setup quality, risk management, discipline, and adherence to your playbook strategies.
              Complete your trade journal entries thoroughly for best results.
            </p>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {!selectedReview ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Past Reviews</h2>
          {reviews.length === 0 ? (
            <div className="glass p-12 text-center">
              <Bot className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-text-primary mb-2">No Reviews Yet</h3>
              <p className="text-text-secondary mb-6 max-w-md mx-auto">
                Start journaling your trades and request an AI analysis to receive personalized feedback on your trading performance.
              </p>
              {trades.length > 0 ? (
                <button onClick={() => handleRequestReview(trades[0].id)} className="btn-gold inline-flex items-center space-x-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Request First Review</span>
                </button>
              ) : (
                <p className="text-sm text-text-muted">Add some trades first!</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  onClick={() => setSelectedReview(review)}
                  className="glass p-6 cursor-pointer hover:border-accent-gold/30 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="px-2 py-1 text-[9px] font-bold uppercase bg-accent-gold/10 text-accent-gold rounded">
                          {review.pair}
                        </span>
                        <span className="text-[10px] text-text-muted">{review.date}</span>
                      </div>
                      <h3 className="font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
                        Trade {review.tradeId.slice(0, 8)}...
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-mono font-bold" style={{ color: review.overallScore >= 6 ? '#00E676' : review.overallScore >= 4 ? '#D4AF37' : '#FF1744' }}>
                        {review.overallScore}/10
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                    {review.summary}
                  </p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-[10px] text-text-muted">
                      <Clock className="w-3 h-3" />
                      <span>{review.timestamp}</span>
                    </div>
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                      review.overallScore >= 7
                        ? "bg-data-profit/10 text-data-profit"
                        : review.overallScore >= 5
                        ? "bg-accent-gold/10 text-accent-gold"
                        : "bg-data-loss/10 text-data-loss"
                    }`}>
                      {getScoreLabel(review.overallScore)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedReview(null)}
            className="text-text-muted hover:text-accent-gold text-sm flex items-center space-x-1"
          >
            <span>← Back to reviews</span>
          </button>

          <div className="glass p-8">
            {/* Score Header */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-white/10">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="px-3 py-1 text-xs font-bold uppercase bg-accent-gold/10 text-accent-gold rounded">
                    {selectedReview.pair}
                  </span>
                  <span className="text-[11px] text-text-muted uppercase">{selectedReview.date}</span>
                  <span className="text-[11px] text-text-muted">ID: {selectedReview.tradeId}</span>
                </div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">AI Analysis Report</h2>
                <p className="text-sm text-text-secondary">{selectedReview.summary}</p>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-mono font-bold ${getScoreColor(selectedReview.overallScore)}`}>
                  {selectedReview.overallScore}
                </div>
                <div className="text-[11px] text-text-muted uppercase mt-1">Overall Score</div>
                <div className={`text-sm font-bold uppercase mt-1 ${getScoreColor(selectedReview.overallScore)}`}>
                  {getScoreLabel(selectedReview.overallScore)}
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 bg-bg-void/50 rounded-lg">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Market Context</p>
                <p className="text-sm text-text-primary">{selectedReview.marketContext}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Risk Management</p>
                <p className="text-sm text-text-primary">{selectedReview.riskManagement}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Psychology Notes</p>
                <p className="text-sm text-text-primary">{selectedReview.psychologyNotes}</p>
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="p-6 bg-data-profit/5 border border-data-profit/20 rounded-xl">
                <div className="flex items-center mb-4">
                  <TrendingUp className="w-5 h-5 text-data-profit mr-2" />
                  <h3 className="font-semibold text-data-profit">Strengths</h3>
                </div>
                <ul className="space-y-3">
                  {selectedReview.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-data-profit mr-2 mt-1">✓</span>
                      <span className="text-sm text-text-secondary">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-data-warning/5 border border-data-warning/20 rounded-xl">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="w-5 h-5 text-data-warning mr-2" />
                  <h3 className="font-semibold text-data-warning">Areas for Improvement</h3>
                </div>
                <ul className="space-y-3">
                  {selectedReview.improvements.map((improvement, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-data-warning mr-2 mt-1">!</span>
                      <span className="text-sm text-text-secondary">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Suggestions */}
            <div className="p-6 bg-accent-gold/5 border border-accent-gold/20 rounded-xl">
              <div className="flex items-center mb-4">
                <Lightbulb className="w-5 h-5 text-accent-gold mr-2" />
                <h3 className="font-semibold text-accent-gold">Actionable Suggestions</h3>
              </div>
              <ul className="space-y-3">
                {selectedReview.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-accent-gold mr-2 mt-1">→</span>
                    <span className="text-sm text-text-secondary">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
              <p className="text-[10px] text-text-muted">
                Analysis generated by AI at {selectedReview.timestamp}
              </p>
              <button className="flex items-center space-x-2 text-[11px] text-accent-gold hover:underline">
                <MessageSquare className="w-4 h-4" />
                <span>Ask follow-up questions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
