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
  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [sessionData, historyData] = await Promise.all([
          getSession(userId).catch(() => null),
          getHistory(userId, { limit: 100, requestType: filter !== 'all' ? filter : undefined, search: searchQuery || undefined })
        ])
        setSession(sessionData)
        setHistory(historyData.history || [])
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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
          {session && (
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
              <div className="flex gap-2">
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
          </div>

          {/* History List */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Loading history...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No history found. Start using the extension to see your interactions here!</p>
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
