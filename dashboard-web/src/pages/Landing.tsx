import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center text-white relative z-10">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Create your personal knowledge base
        </h1>
        <p className="text-xl md:text-2xl mb-12 text-primary-100">
          Save summaries and original content in one place for review, search, and sharing.
        </p>
        <div className="flex justify-center">
          <Link
            to="/dashboard"
            className="px-8 py-4 bg-white text-primary-700 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  )
}
