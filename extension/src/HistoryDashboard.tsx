import React, { useState } from 'react';
import { Search, Clock, FileText, Video, Image, Code, Globe, Phone, MessageCircle, Mail, Youtube, Lightbulb, Baby, CheckSquare, Send } from 'lucide-react';

export default function HistoryDashboard() {
  const [currentPage, setCurrentPage] = useState('history');
  const [authTab, setAuthTab] = useState('login');

  const historyItems = [
    {
      type: 'summarize',
      title: 'Machine Learning Fundamentals',
      url: 'medium.com/ai-articles',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Summarized'
    },
    {
      type: 'translate',
      title: 'Les Nouvelles Technologies',
      url: 'lefigaro.fr/tech',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Translated'
    },
    {
      type: 'explain',
      title: 'Quantum Computing Basics',
      url: 'nature.com/articles',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Explained'
    },
    {
      type: 'extract',
      title: 'Product Launch Presentation',
      url: 'docs.google.com/presentation',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Data Extracted'
    },
    {
      type: 'analyze',
      title: 'Market Research Report 2024',
      url: 'statista.com/reports',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Analyzed'
    },
    {
      type: 'simplify',
      title: 'Advanced Neural Networks',
      url: 'arxiv.org/papers',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Simplified'
    },
    {
      type: 'summarize',
      title: 'Climate Change Impact Study',
      url: 'ipcc.ch/reports',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Summarized'
    },
    {
      type: 'translate',
      title: 'Deutsche Wirtschaftsnachrichten',
      url: 'handelsblatt.com',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Translated'
    },
    {
      type: 'explain',
      title: 'Blockchain Technology Explained',
      url: 'ethereum.org/learn',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Explained'
    },
    {
      type: 'extract',
      title: 'AI Ethics Guidelines',
      url: 'unesco.org/ai-ethics',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Data Extracted'
    },
    {
      type: 'analyze',
      title: 'Financial Markets Overview',
      url: 'bloomberg.com/markets',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Analyzed'
    },
    {
      type: 'simplify',
      title: 'Tax Law Changes 2024',
      url: 'irs.gov/updates',
      time: '15:37:16',
      date: '01/03/2023',
      action: 'Simplified'
    }
  ];

  const quickActions = [
    {
      id: 'youtube',
      icon: <Youtube size={20} />,
      title: 'Summarize YouTube',
      description: 'Get video summaries',
      color: 'bg-red-500'
    },
    {
      id: 'summarize',
      icon: <FileText size={20} />,
      title: 'Summarize Page',
      description: 'Get a concise summary',
      color: 'bg-teal-500'
    },
    {
      id: 'keypoints',
      icon: <Lightbulb size={20} />,
      title: 'Key Points',
      description: 'Extract main takeaways',
      color: 'bg-orange-500'
    },
    {
      id: 'explain',
      icon: <Baby size={20} />,
      title: "Explain Like I'm 5",
      description: 'Simplify the content',
      color: 'bg-pink-500'
    },
    {
      id: 'actions',
      icon: <CheckSquare size={20} />,
      title: 'Action Items',
      description: 'Identify next steps',
      color: 'bg-blue-500'
    },
    {
      id: 'email',
      icon: <Send size={20} />,
      title: 'Email Tone & Replies',
      description: 'Generate email responses',
      color: 'bg-purple-500'
    }
  ];

  const getActionColor = (type: string) => {
    switch(type) {
      case 'summarize': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'translate': return 'bg-green-100 text-green-700 border-green-200';
      case 'explain': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'extract': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'analyze': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'simplify': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActionIcon = (type: string) => {
    switch(type) {
      case 'summarize': return <FileText size={14} />;
      case 'translate': return <Globe size={14} />;
      case 'explain': return <Code size={14} />;
      case 'extract': return <Image size={14} />;
      case 'analyze': return <Search size={14} />;
      case 'simplify': return <Video size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const renderContent = () => {
    switch(currentPage) {
      case 'dashboard':
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>
            <div className="bg-white rounded-xl p-8 border border-slate-200">
              <p className="text-slate-600">Welcome to ContextCopilot Dashboard</p>
            </div>
          </div>
        );

      case 'quickactions':
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
              {quickActions.map((action) => (
                <div
                  key={action.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer group hover:border-slate-300 flex items-center gap-4"
                >
                  <div className={`${action.color} w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                    {action.icon}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-base group-hover:text-blue-600 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                      {action.description}
                    </p>
                  </div>

                  <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="p-8 flex items-center justify-center min-h-[600px]">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-200">
              <h2 className="text-3xl font-bold text-center mb-6">
                {authTab === 'login' ? 'Login Form' : 'Signup Form'}
              </h2>
              
              {/* Toggle Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    authTab === 'login'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border-2 border-slate-200'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setAuthTab('signup')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    authTab === 'signup'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border-2 border-slate-200'
                  }`}
                >
                  Signup
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email Address"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {authTab === 'signup' && (
                  <input
                    type="password"
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}

                {authTab === 'login' && (
                  <div className="text-left">
                    <a href="#" className="text-blue-600 text-sm hover:underline">
                      Forgot password?
                    </a>
                  </div>
                )}

                <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                  {authTab === 'login' ? 'Login' : 'Signup'}
                </button>

                {authTab === 'login' && (
                  <p className="text-center text-sm text-slate-600">
                    Not a member?{' '}
                    <button
                      onClick={() => setAuthTab('signup')}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Signup now
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Contact Us</h2>
            <p className="text-slate-600 mb-8">We're here to help</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
              <div className="bg-slate-100 rounded-xl p-8 text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="text-white" size={32} />
                </div>
                <h3 className="font-bold text-slate-800 mb-2 text-lg">Call Us</h3>
                <p className="text-blue-600 font-semibold">1-844-654-4111</p>
              </div>

              <div className="bg-slate-100 rounded-xl p-8 text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="text-white" size={32} />
                </div>
                <h3 className="font-bold text-slate-800 mb-2 text-lg">Chat Live</h3>
                <p className="text-slate-600 text-sm mb-3">We're available Sun 7:00pm EST - Friday 7:00pm EST</p>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                  Chat Now
                </button>
              </div>

              <div className="bg-slate-100 rounded-xl p-8 text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="text-white" size={32} />
                </div>
                <h3 className="font-bold text-slate-800 mb-2 text-lg">Ask a Question</h3>
                <p className="text-slate-600 text-sm mb-3">Fill out our form and we'll get back to you in 24 hours.</p>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        );

      case 'history':
      default:
        return (
          <div className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {historyItems.map((item, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-lg transition-all cursor-pointer group hover:border-slate-300 flex flex-col aspect-square">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border flex items-center gap-1 ${getActionColor(item.type)}`}>
                      {getActionIcon(item.type)}
                      <span className="hidden sm:inline">{item.action}</span>
                    </span>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center mb-2">
                    <h3 className="font-bold text-slate-800 mb-1 text-xs leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                      <Globe size={10} />
                      <span className="truncate">{item.url}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 pt-2 border-t border-slate-100">
                    <Clock size={9} />
                    <span className="truncate">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      {/* Header */}
      <div className="bg-slate-900 text-white py-6 px-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">
            {currentPage === 'dashboard' && 'ContextCopilot Dashboard'}
            {currentPage === 'quickactions' && 'Quick Actions'}
            {currentPage === 'history' && 'ContextCopilot History'}
            {currentPage === 'profile' && 'Profile Settings'}
            {currentPage === 'contact' && 'Contact Us'}
          </h1>
          <p className="text-slate-300 mt-1 text-sm">
            {currentPage === 'history' && 'Track all your webpage interactions'}
            {currentPage === 'quickactions' && 'Choose an action to perform'}
            {currentPage === 'profile' && 'Manage your account settings'}
            {currentPage === 'contact' && 'Get in touch with us'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="flex">
            {/* Sidebar */}
            <div className="w-64 bg-slate-900 flex-shrink-0">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-700">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">CC</span>
                  </div>
                  <div>
                    <span className="font-bold text-white block text-sm">ContextCopilot</span>
                    <span className="text-slate-400 text-xs">Chrome Extension</span>
                  </div>
                </div>

                <nav className="space-y-1">
                  <button
                    onClick={() => setCurrentPage('dashboard')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${
                      currentPage === 'dashboard'
                        ? 'text-white bg-slate-800 border border-slate-700'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className={currentPage === 'dashboard' ? 'font-semibold' : 'font-medium'}>Dashboard</span>
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage('quickactions')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${
                      currentPage === 'quickactions'
                        ? 'text-white bg-slate-800 border border-slate-700'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className={currentPage === 'quickactions' ? 'font-semibold' : 'font-medium'}>Quick Actions</span>
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage('history')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${
                      currentPage === 'history'
                        ? 'text-white bg-slate-800 border border-slate-700'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                    <span className={currentPage === 'history' ? 'font-semibold' : 'font-medium'}>History</span>
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage('profile')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${
                      currentPage === 'profile'
                        ? 'text-white bg-slate-800 border border-slate-700'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className={currentPage === 'profile' ? 'font-semibold' : 'font-medium'}>Profile</span>
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage('contact')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${
                      currentPage === 'contact'
                        ? 'text-white bg-slate-800 border border-slate-700'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className={currentPage === 'contact' ? 'font-semibold' : 'font-medium'}>Contact Us</span>
                  </button>
                </nav>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-slate-50">
              {currentPage !== 'contact' && currentPage !== 'profile' && (
                <div className="bg-white border-b border-slate-200 px-8 py-4">
                  <div className="relative max-w-2xl">
                    <input
                      type="text"
                      placeholder="Search..."
                      className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  </div>
                </div>
              )}

              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}