// --- PENTING: Untuk keperluan demonstrasi, API Key diletakkan di sini. ---
// --- UNTUK PRODUKSI, SANGAT DISARANKAN MENGGUNAKAN SERVERLESS FUNCTION SEBAGAI PROXY UNTUK KEAMANAN. ---
const UBERDUCK_API_KEY = "bb622df48638253bf341e93208407317965e35b8fe1015ae6faf2dacbd051f59a0f46051a83cfb1a219e78fcf295a913"; // <<< GANTI DENGAN API Key Uberduck Anda di sini!

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

// Fungsi untuk memuat daftar suara dari Uberduck API
async function loadVoices() {
    showStatus('Memuat daftar suara...', 'info');
    voiceSelect.innerHTML = '<option value="">Memuat suara...</option>'; // Reset & tampilkan loading
    voiceSelect.disabled = true; // Nonaktifkan saat memuat
    generateButton.disabled = true; // Nonaktifkan juga tombol generate saat memuat

    try {
        if (!BEARER_TOKEN || BEARER_TOKEN === "bb622df48638253bf341e93208407317965e35b8fe1015ae6faf2dacbd051f59a0f46051a83cfb1a219e78fcf295a913") {
            throw new Error('API Key Uberduck belum disetel. Harap ganti "YOUR_UBERDUCK_API_KEY" di script.js.');
        }

        const response = await fetch('https://api.uberduck.ai/v1/voices', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            // Cek jika error 401 Unauthorized
            if (response.status === 401) {
                throw new Error(`Unauthorized: API Key Anda mungkin tidak valid atau tidak memiliki izin. (${errorData.detail || 'Periksa API Key'})`);
            }
            throw new Error(`Gagal memuat suara: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const apiResponse = await response.json(); // Ini akan menjadi Object { total: 1069, voices: (...) }
        console.log("Uberduck voices API response:", apiResponse);

        // Ambil array suara dari properti 'voices' di dalam objek respons
        const allVoices = apiResponse.voices;

        if (!Array.isArray(allVoices)) {
            throw new TypeError("Properti 'voices' dalam respons API Uberduck bukan array seperti yang diharapkan.");
        }

        console.log("Jumlah total suara dari API:", allVoices.length); // Debugging: Log jumlah total suara
        console.log("Detail semua suara dari API (periksa properti 'category' dan 'display_name'):", allVoices); // <<< PENTING: LOG INI AKAN MENAMPILKAN DATA MENTAH

        // =====================================================================
        // PERUBAHAN UTAMA: MENGHAPUS FILTER KATEGORI SEMENTARA
        // Ini akan memungkinkan semua suara dimuat ke dropdown
        // =====================================================================
        const ttsVoices = allVoices; // Sekarang ini akan mengambil SEMUA suara tanpa filter kategori.

        console.log("Jumlah suara setelah filter (saat ini tanpa filter kategori):", ttsVoices.length); // Debugging: Log jumlah suara setelah filter

        voiceSelect.innerHTML = '<option value="">-- Pilih Suara --</option>'; // Opsi default

        if (ttsVoices.length === 0) {
            // Ini akan dieksekusi jika API mengembalikan 0 suara total
            voiceSelect.innerHTML += '<option value="">Tidak ada suara yang tersedia dari API</option>';
            throw new Error('Tidak ada suara yang ditemukan dari API Uberduck.');
        }

        // Pastikan suara memiliki properti yang diperlukan sebelum menambahkannya
        ttsVoices.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '')); // Urutkan berdasarkan nama, tangani jika display_name undefined
        ttsVoices.forEach(voice => {
            // Menambahkan pengecekan properti sebelum membuat opsi
            if (voice.name && voice.display_name && voice.category) {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.display_name} (${voice.category})`;
                voiceSelect.appendChild(option);
            } else {
                console.warn("Suara dengan format tidak lengkap diabaikan (kurang 'name', 'display_name', atau 'category'):", voice);
            }
        });
        
        voiceSelect.disabled = false; // Aktifkan dropdown setelah suara dimuat
        generateButton.disabled = false; // Aktifkan tombol generate
        hideStatus();

    } catch (error) {
        console.error('Error loading voices:', error);
        showStatus(`Gagal memuat suara: ${error.message}. Pastikan API Key benar & jaringan tersedia.`, 'error');
        voiceSelect.innerHTML = '<option value="">Gagal memuat suara</option>'; // Opsional: tampilkan pesan error di dropdown
        voiceSelect.disabled = true; // Nonaktifkan dropdown jika gagal
        generateButton.disabled = true; // Nonaktifkan tombol generate jika gagal
    }
}

// Fungsi untuk menghasilkan suara dari teks menggunakan Uberduck API
async function generateSpeech() {
    const text = textInput.value.trim();
    const selectedVoice = voiceSelect.value;

    if (!BEARER_TOKEN || BEARER_TOKEN === "bb622df48638253bf341e93208407317965e35b8fe1015ae6faf2dacbd051f59a0f46051a83cfb1a219e78fcf295a913") {
        showStatus('Harap ganti "YOUR_UBERDUCK_API_KEY" di script.js dengan API Key Anda yang sebenarnya.', 'error');
        return;
    }

    if (!text) {
        showStatus('Harap masukkan teks yang ingin diubah menjadi suara.', 'error');
        return;
    }
    if (!selectedVoice || selectedVoice === "") {
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
                throw new Error(`Unauthorized: API Key Anda mungkin tidak valid atau tidak memiliki izin. (${errorData.detail || 'Periksa API Key'})`);
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
                // Jangan lempar error di sini, biarkan terus polling jika bukan 404/500
                // Cek jika ada status spesifik yang menunjukkan kegagalan permanen
                // Untuk sementara, kita biarkan saja dan lanjutkan polling
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
        showStatus(`Teks Anda melebihi batas ${MAX_TEXT_LENGTH} karakter (dibatasi).`, 'error');
    } else {
        charCount.style.color = '#666';
        hideStatus();
    }
});
