import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productAPI } from '../api';

function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await productAPI.getAll();
      setProducts(response.data.products || []);
    } catch (err) {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home">
      <h1>Welcome to Big Dog Thrift 🐕</h1>
      <p>Find amazing second-hand items at great prices!</p>

      {loading && <p>Loading products...</p>}

      {error && (
        <div className="error">
          <p>{error}</p>
          <button onClick={fetchProducts}>Retry</button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <p>No products available right now. Check back soon!</p>
      )}

      <div className="product-grid">
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/products/${product.id}`}
            className="product-card"
          >
            {product.photo_url ? (
              <img src={product.photo_url} alt={product.name} loading="lazy" />
            ) : (
              <div className="product-card__placeholder">No image</div>
            )}
            <h3>{product.name}</h3>
            <p className="price">KSh {Number(product.price).toLocaleString()}</p>
            <p className="category">{product.category}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Home;
