import { useState, useEffect } from 'react'
import { Home, Search, PlusSquare, Heart, User, MoreHorizontal, MessageCircle, Send, X } from 'lucide-react'
import { supabase } from './supabaseClient'

function App() {
  const [posts, setPosts] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Post Feed Fetching
  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (data) setPosts(data)
    } catch (error) {
      console.error('Error fetching posts:', error.message)
      // Fallback dummy data if table is empty or error occurs
      if (posts.length === 0) {
        setPosts([
          { id: '1', caption: 'Welcome to MiniGram! Add a new post using the + button.', image_url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop&q=60', created_at: new Date().toISOString() }
        ])
      }
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="logo">
          <span className="logo-text">MiniGram</span>
        </div>
        <div className="nav-links">
          <div className="nav-item active">
            <Home size={24} />
            <span>Home</span>
          </div>
          <div className="nav-item">
            <Search size={24} />
            <span>Search</span>
          </div>
          <div className="nav-item" onClick={() => setIsModalOpen(true)}>
            <PlusSquare size={24} />
            <span>Create</span>
          </div>
          <div className="nav-item">
            <Heart size={24} />
            <span>Notifications</span>
          </div>
          <div className="nav-item">
            <User size={24} />
            <span>Profile</span>
          </div>
        </div>
      </nav>

      {/* Main Feed Content */}
      <main className="main-content">
        <div className="feed-container">
          {posts.map(post => (
            <Post key={post.id} post={post} />
          ))}
          {posts.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-secondary)' }}>
              No posts yet. Be the first to post!
            </div>
          )}
        </div>
      </main>

      {/* Create Post Modal */}
      {isModalOpen && (
        <CreatePostModal 
          onClose={() => setIsModalOpen(false)} 
          onPostCreated={() => {
            setIsModalOpen(false)
            fetchPosts()
          }} 
        />
      )}
    </div>
  )
}

function Post({ post }) {
  const [liked, setLiked] = useState(false)

  // Calculate generic time ago (simplified for demo)
  const timeAgo = "2 HOURS AGO"

  return (
    <article className="post">
      <div className="post-header">
        <div className="avatar">
          {/* using cute random seed avatar */}
          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${post.id}`} alt="avatar" />
        </div>
        <span className="username">user_{post.id?.substring(0,4) || '123'}</span>
        <MoreHorizontal size={20} style={{ marginLeft: 'auto', cursor: 'pointer' }} />
      </div>

      <img src={post.image_url} alt="Post content" className="post-image" />

      <div className="post-actions">
        <Heart 
          size={24} 
          className="action-icon" 
          fill={liked ? "#ed4956" : "none"} 
          color={liked ? "#ed4956" : "currentColor"}
          onClick={() => setLiked(!liked)} 
        />
        <MessageCircle size={24} className="action-icon" />
        <Send size={24} className="action-icon" />
      </div>

      <div className="post-likes">
        {liked ? 1 : 0} likes
      </div>

      <div className="post-caption">
        <span className="username">user_{post.id?.substring(0,4) || '123'}</span>
        {post.caption}
      </div>

      <div className="post-time">{timeAgo}</div>
    </article>
  )
}

function CreatePostModal({ onClose, onPostCreated }) {
  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!imageUrl) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('posts')
        .insert([{ image_url: imageUrl, caption }])
      
      if (error) throw error
      onPostCreated()
    } catch (error) {
      alert('Error creating post: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>Create new post</span>
          <button className="close-btn" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="modal-body">
          <input 
            type="text" 
            placeholder="Image URL (e.g. https://images.unsplash.com/...)" 
            className="input-field"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
          />
          {imageUrl && (
            <img 
              src={imageUrl} 
              alt="Preview" 
              style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
              onError={(e) => e.target.style.display = 'none'}
              onLoad={(e) => e.target.style.display = 'block'}
            />
          )}
          <textarea 
            placeholder="Write a caption..." 
            className="input-field"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
          <button 
            className="btn-primary" 
            onClick={handleSubmit}
            disabled={!imageUrl || loading}
          >
            {loading ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
