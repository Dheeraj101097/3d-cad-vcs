const mongoose = require('mongoose');
const { Readable } = require('stream');

const BUCKET = 'cadfiles';

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
}

// Upload a Buffer → returns the GridFS ObjectId
function uploadBuffer(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const b = bucket();
    const stream = b.openUploadStream(filename, { contentType });
    Readable.from(buffer).pipe(stream);
    stream.on('finish', () => resolve(stream.id));
    stream.on('error', reject);
  });
}

// Stream a file from GridFS directly to an Express response
async function pipeToResponse(gridfsId, res) {
  if (!gridfsId) {
    if (!res.headersSent) res.status(404).json({ message: 'No file stored' });
    return;
  }
  try {
    const oid = new mongoose.Types.ObjectId(gridfsId);
    const b = bucket();
    // Check existence first — prevents unhandled rejection crash on missing files
    const files = await b.find({ _id: oid }).limit(1).toArray();
    if (!files.length) {
      if (!res.headersSent) res.status(404).json({ message: 'File not found in storage' });
      return;
    }
    const stream = b.openDownloadStream(oid);
    stream.on('error', (err) => {
      console.error('GridFS stream error:', err.message);
      if (!res.headersSent) res.status(500).json({ message: 'Stream error' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (e) {
    console.error('GridFS pipeToResponse error:', e.message);
    if (!res.headersSent) res.status(500).json({ message: 'Storage error' });
  }
}

// Download a file into a Buffer (for text content reads)
function downloadToBuffer(gridfsId) {
  return new Promise((resolve, reject) => {
    if (!gridfsId) return reject(new Error('No gridfsId provided'));
    const chunks = [];
    const stream = bucket().openDownloadStream(new mongoose.Types.ObjectId(gridfsId));
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Delete a file from GridFS (silent if missing)
async function deleteFile(gridfsId) {
  if (!gridfsId) return;
  try {
    await bucket().delete(new mongoose.Types.ObjectId(gridfsId));
  } catch (e) {
    console.error('GridFS delete error:', e.message);
  }
}

module.exports = { uploadBuffer, pipeToResponse, downloadToBuffer, deleteFile };
