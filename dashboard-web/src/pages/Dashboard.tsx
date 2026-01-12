import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getHistory, getSession, type HistoryItem, type SessionResponse } from '../utils/api'

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Get userId from URL params or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlUserId = urlParams.get('userId')
    
    if (urlUserId) {
      setUserId(urlUserId)
      localStorage.setItem('contextcopilot_user_id', urlUserId)
    } else {
      const storedUserId = localStorage.getItem('contextcopilot_user_id')
      if (storedUserId) {
        setUserId(storedUserId)
      } else {
        // Generate a new userId if none exists
        const newUserId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        setUserId(newUserId)
        localStorage.setItem('contextcopilot_user_id', newUserId)
      }
    }
  }, [])

  // Fetch session and history when userId is available
  const fetchData = async () => {
    if (!userId) {
      setError(null) // Don't show error, just show empty state
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null) // Clear any previous errors
    try {
      const [sessionData, historyData] = await Promise.all([
        getSession(userId).catch((err) => {
          console.error('Failed to fetch session:', err)
          return null // Return null instead of throwing
        }),
        getHistory(userId, { limit: 100, requestType: filter !== 'all' ? filter : undefined, search: searchQuery || undefined }).catch((err) => {
          console.error('Failed to fetch history:', err)
          // If it's a network error (backend not running), return empty array
          // Otherwise, return empty array to show empty state
          return { history: [], total: 0, limit: 100, offset: 0 }
        })
      ])
      setSession(sessionData)
      setHistory(historyData?.history || [])
      setLastRefresh(new Date())
    } catch (err) {
      // Silently handle errors - just show empty state
      console.error('Failed to fetch data:', err)
      setHistory([])
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (!userId) return

    // Fetch immediately
    fetchData()

    // Set up auto-refresh every 5 seconds to get new prompts/outputs
    const refreshInterval = setInterval(() => {
      fetchData()
    }, 5000) // Refresh every 5 seconds

    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval)
  }, [userId, filter, searchQuery])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'ask': 'Q&A',
      'summarize': 'Summary',
      'key-points': 'Key Points',
      'explain-like-5': 'Explain Like I\'m 5',
      'action-items': 'Action Items'
    }
    return labels[type] || type
  }

  const getOutputText = (item: HistoryItem) => {
    return item.output.answer || 
           item.output.summary || 
           item.output.keyPoints || 
           item.output.explanation || 
           item.output.actionItems || 
           'No output available'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">ContextCopilot</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Home
              </Link>
              {userId && (
                <span className="text-xs text-gray-500">User: {userId.substring(0, 20)}...</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Stats Section */}
          {session && session.stats.totalInteractions > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">Total Interactions</h3>
                <p className="text-2xl font-bold text-gray-900">{session.stats.totalInteractions}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">Pages Interacted</h3>
                <p className="text-2xl font-bold text-gray-900">{session.stats.pagesInteracted}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">First Active</h3>
                <p className="text-sm font-semibold text-gray-900">{formatDate(session.createdAt)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">Last Active</h3>
                <p className="text-sm font-semibold text-gray-900">{formatDate(session.lastActive)}</p>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh data"
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
                {['all', 'ask', 'summarize', 'key-points', 'explain-like-5', 'action-items'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? 'All' : getRequestTypeLabel(f)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Auto-refreshing every 5 seconds • Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>

          {/* History List */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="mb-4">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Your dashboard is empty</h3>
                <p className="text-gray-500 mb-4">
                  Start using the ContextCopilot extension to see your interactions, summaries, and key points here!
                </p>
                <p className="text-sm text-gray-400">
                  The dashboard will automatically update as you use the extension.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item._id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                          {getRequestTypeLabel(item.requestType)}
                        </span>
                        <span className="text-sm text-gray-500">{formatDate(item.timestamp)}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.pageTitle}</h3>
                      <a
                        href={item.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {item.pageUrl}
                      </a>
                      {item.input.question && (
                        <p className="mt-2 text-sm text-gray-700">
                          <strong>Question:</strong> {item.input.question}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{getOutputText(item)}</p>
                    {item.output.citations && item.output.citations.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Citations:</h4>
                        <ul className="space-y-2">
                          {item.output.citations.map((citation, idx) => (
                            <li key={idx} className="text-sm text-gray-600 pl-4 border-l-2 border-gray-200">
                              "{citation.quote}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
