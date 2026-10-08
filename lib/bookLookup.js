export async function getBookDetailsByISBN(isbn) {
  const cleanIsbn = isbn.replace(/[-\s]/g, '');

  try {
    // 1. Öncelik: Google Books API
    const gResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`
    );
    const gData = await gResponse.json();

    if (gData.items && gData.items.length > 0) {
      const info = gData.items[0].volumeInfo;
      return {
        isbn: cleanIsbn,
        title: info.title || '',
        author: info.authors ? info.authors.join(', ') : '',
        publisher: info.publisher || '',
        cover_url: info.imageLinks?.thumbnail || ''
      };
    }

    // 2. Yedek: Open Library API (Google'da bulunamazsa)
    const olResponse = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`
    );
    const olData = await olResponse.json();
    const olKey = `ISBN:${cleanIsbn}`;

    if (olData[olKey]) {
      const book = olData[olKey];
      return {
        isbn: cleanIsbn,
        title: book.title || '',
        author: book.authors ? book.authors.map((a) => a.name).join(', ') : '',
        publisher: book.publishers ? book.publishers.map((p) => p.name).join(', ') : '',
        cover_url: book.cover?.medium || book.cover?.small || ''
      };
    }

    return null;
  } catch (err) {
    console.error('Kitap sorgulama hatası:', err);
    return null;
  }
}