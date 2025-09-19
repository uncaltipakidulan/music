// --- PENTING: Untuk keperluan demonstrasi, API Key diletakkan di sini. ---
// --- UNTUK PRODUKSI, SANGAT DISARANKAN MENGGUNAKAN SERVERLESS FUNCTION SEBAGAI PROXY UNTUK KEAMANAN. ---
const UBERDUCK_API_KEY = "2ba20ba477daa3a0112f4d2cb54d338f25feb101219d0a055602e9fb972ea4a685bf7b92ccd438a824646cebde99d4ab"; // <<< GANTI DENGAN API Key Uberduck Anda di sini!

// Berdasarkan dokumentasi, autentikasi menggunakan Bearer Token
const BEARER_TOKEN = UBERDUCK_API_KEY;

// DOM Elements
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const voiceSelect = document.getElementById('voiceSelect');
const generateButton = document.getElementById('generateButton');
const statusMessage = document.getElementById('statusMessage');
const audioPlayer = document.getElementById('audioPlayer');
const audioUrlDisplay = document.getElementById('audioUrlDisplay');

// Max length for text input (Uberduck might have its own limits)
const MAX_TEXT_LENGTH = 500;

// Fungsi untuk menampilkan pesan status
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `message ${type}`;
    statusMessage.style.display = 'block';
}

// Fungsi untuk menyembunyikan pesan status
function hideStatus() {
    statusMessage.style.display = 'none';
}

// ... (bagian atas script.js) ...

// Fungsi untuk memuat daftar suara dari Uberduck API
async function loadVoices() {
    showStatus('Memuat daftar suara...', 'info');
    voiceSelect.innerHTML = '<option value="">Memuat suara...</option>'; // Reset & tampilkan loading
    try {
        const response = await fetch('https://api.uberduck.ai/v1/voices', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gagal memuat suara: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const apiResponse = await response.json(); // Ubah nama variabel untuk lebih jelas
        console.log("Uberduck voices API response:", apiResponse);

        // Ambil array suara dari properti 'voices' di dalam objek respons
        const allVoices = apiResponse.voices; // <--- PERUBAHAN UTAMA DI SINI

        if (!Array.isArray(allVoices)) {
            throw new TypeError("Data 'voices' dalam respons API Uberduck bukan array.");
        }

        // Filter suara yang bisa digunakan untuk text-to-speech, voice_conversion, atau singing
        const ttsVoices = allVoices.filter(v =>
            v.category === 'tts' || v.category === 'voice_conversion' || v.category === 'singing'
        );

        voiceSelect.innerHTML = '<option value="">-- Pilih Suara --</option>'; // Opsi default
        ttsVoices.sort((a, b) => a.display_name.localeCompare(b.display_name)); // Urutkan berdasarkan nama
        ttsVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.display_name} (${voice.category})`;
            voiceSelect.appendChild(option);
        });
        hideStatus();
    } catch (error) {
        console.error('Error loading voices:', error);
        showStatus(`Gagal memuat suara: ${error.message}. Pastikan API Key benar dan jaringan tersedia.`, 'error');
        voiceSelect.innerHTML = '<option value="">Gagal memuat suara</option>';
        generateButton.disabled = true;
    }
}

// ... (sisa script.js tidak berubah) ...

// Fungsi untuk menghasilkan suara dari teks menggunakan Uberduck API
async function generateSpeech() {
    const text = textInput.value.trim();
    const selectedVoice = voiceSelect.value;

    if (!BEARER_TOKEN || BEARER_TOKEN === "YOUR_UBERDUCK_API_KEY") {
        showStatus('Harap ganti "YOUR_UBERDUCK_API_KEY" di script.js dengan API Key Anda yang sebenarnya.', 'error');
        return;
    }

    if (!text) {
        showStatus('Harap masukkan teks yang ingin diubah menjadi suara.', 'error');
        return;
    }
    if (!selectedVoice) {
        showStatus('Harap pilih suara.', 'error');
        return;
    }

    generateButton.disabled = true;
    showStatus('Sedang memproses suara Anda...', 'info');
    audioPlayer.removeAttribute('src'); // Hapus audio sebelumnya
    audioUrlDisplay.textContent = ''; // Hapus URL sebelumnya
    audioPlayer.load(); // Memuat ulang audio player

    try {
        const response = await fetch('https://api.uberduck.ai/v1/text-to-speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text, // Sesuai dengan contoh cURL di dokumentasi Uberduck
                voice: selectedVoice
                // Anda juga bisa menambahkan "model": "polly_neural" jika diperlukan
                // atau parameter lain dari dokumentasi, misalnya:
                // "model": "uberduck_v2"
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 401) {
                throw new Error(`Unauthorized: API Key Anda mungkin tidak valid atau tidak memiliki izin. (${errorData.detail || ''})`);
            }
            if (response.status === 400 && errorData.detail && errorData.detail.includes("exceeds the maximum character limit")) {
                throw new Error(`Teks terlalu panjang. Batas maksimal teks mungkin telah terlampaui.`);
            }
            throw new Error(`Uberduck API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        if (data.uuid) {
            const audioUrl = await pollForAudio(data.uuid);
            if (audioUrl) {
                audioPlayer.src = audioUrl;
                audioPlayer.play();
                audioUrlDisplay.textContent = `URL Audio: ${audioUrl}`;
                showStatus('Audio berhasil dibuat dan sedang diputar!', 'success');
            } else {
                showStatus('Gagal mendapatkan URL audio setelah beberapa percobaan.', 'error');
            }
        } else {
            throw new Error('Respons API tidak mengandung UUID untuk polling.');
        }

    } catch (error) {
        console.error('Error generating Uberduck speech:', error);
        showStatus(`Terjadi kesalahan: ${error.message}`, 'error');
    } finally {
        generateButton.disabled = false;
    }
}

// Fungsi untuk polling status audio
async function pollForAudio(uuid) {
    let attempts = 0;
    const maxAttempts = 30; // Batas percobaan lebih banyak untuk stabilitas (30 * 3 detik = 90 detik)
    const delay = 3000; // Tunggu 3 detik setiap percobaan

    while (attempts < maxAttempts) {
        attempts++;
        showStatus(`Mencari audio Anda (percobaan ${attempts}/${maxAttempts})...`, 'info');
        try {
            const response = await fetch(`https://api.uberduck.ai/v1/speak-status?uuid=${uuid}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${BEARER_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Polling API error: ${response.status}`);
            }

            const statusData = await response.json();
            if (statusData.finished && statusData.path) {
                return statusData.path; // Audio sudah siap, kembalikan URL
            } else if (statusData.failed) {
                showStatus('Generasi audio gagal di Uberduck.', 'error');
                return null;
            }
        } catch (error) {
            console.error('Error during polling:', error);
            // Lanjutkan polling meskipun ada error sementara
        }
        await new Promise(resolve => setTimeout(resolve, delay)); // Tunggu sebelum percobaan berikutnya
    }
    return null; // Gagal mendapatkan audio setelah maxAttempts
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadVoices(); // Muat suara saat halaman pertama kali dimuat
});

generateButton.addEventListener('click', generateSpeech);

textInput.addEventListener('input', () => {
    const currentLength = textInput.value.length;
    charCount.textContent = `${currentLength}/${MAX_TEXT_LENGTH} karakter`;
    if (currentLength > MAX_TEXT_LENGTH) {
        textInput.value = textInput.value.substring(0, MAX_TEXT_LENGTH);
        charCount.style.color = 'red';
        showStatus(`Teks Anda melebihi batas ${MAX_TEXT_LENGTH} karakter.`, 'error');
    } else {
        charCount.style.color = '#666';
        hideStatus();
    }
});
