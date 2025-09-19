// --- PENTING: Untuk keperluan demonstrasi, API Key diletakkan di sini. ---
// --- UNTUK PRODUKSI, SANGAT DISARANKAN MENGGUNAKAN SERVERLESS FUNCTION SEBAGAI PROXY UNTUK KEAMANAN. ---
const UBERDUCK_API_KEY = "ab68368e6200cdda39ca9e06fc0ccf8f0d19a25e78dff0b3fd5da35773e1fd51314c0bb510650f579722ac3f8ac04da1"; // <<< GANTI DENGAN API Key Uberduck Anda di sini!

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
        // Pengecekan API Key placeholder
        if (!BEARER_TOKEN || BEARER_TOKEN === "YOUR_UBERDUCK_API_KEY") {
            throw new Error('API Key Uberduck belum disetel. Harap ganti "YOUR_UBERDUCK_API_KEY" di app.js.');
        }

        const response = await fetch('https://api.uberduck.ai/v1/voices', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Tidak dapat mem-parse respons error sebagai JSON." }));
            // Cek jika error 401 Unauthorized
            if (response.status === 401) {
                throw new Error(`Unauthorized: API Key Anda mungkin tidak valid atau tidak memiliki izin. (${JSON.stringify(errorData)})`);
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

        console.log("Jumlah total suara dari API:", allVoices.length);
        console.log("Detail semua suara dari API (perhatikan properti 'name', 'display_name', 'voicemodel_uuid', 'category'):", allVoices);

        // =====================================================================
        // PERUBAHAN UTAMA: MENGHAPUS FILTER KATEGORI SEMENTARA
        // Ini akan memungkinkan semua suara dimuat ke dropdown
        // =====================================================================
        const voicesToDisplay = [];
        allVoices.forEach(voice => {
            // Pastikan properti yang dibutuhkan ada dan valid
            // voice.name akan kita ganti dengan voice.voicemodel_uuid.
            // voice.category tampaknya tidak selalu ada di API Uberduck untuk semua suara.
            // Kita bisa tambahkan filter lagi di sini jika ingin hanya suara dengan kategori tertentu.
            // Contoh: if (voice.voicemodel_uuid && voice.display_name && voice.category === 'tts') { ... }

            if (voice.voicemodel_uuid && voice.display_name) { // Hanya tambahkan jika voicemodel_uuid dan display_name ada
                voicesToDisplay.push({
                    name: voice.voicemodel_uuid, // Gunakan voicemodel_uuid sebagai nilai 'name' untuk HTML value
                    display_name: voice.display_name,
                    category: voice.category || 'unknown' // Jika category tidak ada, gunakan 'unknown'
                });
            } else {
                // Log peringatan jika ada suara yang tidak memiliki properti dasar
                console.warn("Suara dengan format tidak lengkap diabaikan (kurang 'voicemodel_uuid' atau 'display_name'):", voice);
            }
        });

        console.log("Jumlah suara yang akan ditampilkan setelah pemrosesan:", voicesToDisplay.length);

        voiceSelect.innerHTML = '<option value="">-- Pilih Suara --</option>'; // Opsi default

        if (voicesToDisplay.length === 0) {
            voiceSelect.innerHTML += '<option value="">Tidak ada suara yang tersedia untuk ditampilkan</option>';
            throw new Error('Tidak ada suara valid yang ditemukan dari API Uberduck setelah pemrosesan data.');
        }

        voicesToDisplay.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '')); // Urutkan berdasarkan display_name
        voicesToDisplay.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name; // Ini adalah voicemodel_uuid
            option.textContent = `${voice.display_name} (${voice.category})`;
            voiceSelect.appendChild(option);
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
    const selectedVoice = voiceSelect.value; // selectedVoice akan berisi voice.name (yaitu voicemodel_uuid)

    // Pengecekan API Key placeholder
    if (!BEARER_TOKEN || BEARER_TOKEN === "YOUR_UBERDUCK_API_KEY") {
        showStatus('Harap ganti "YOUR_UBERDUCK_API_KEY" di app.js dengan API Key Anda yang sebenarnya.', 'error');
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
        console.log("Mengirim permintaan text-to-speech ke Uberduck...");
        console.log("Teks:", text);
        console.log("Suara yang dipilih:", selectedVoice);

        const response = await fetch('https://api.uberduck.ai/v1/text-to-speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text, // Sesuai dengan contoh cURL di dokumentasi Uberduck
                voice: selectedVoice // selectedVoice akan berisi voicemodel_uuid, ini yang dikirim ke API
                // Anda juga bisa menambahkan "model": "polly_neural" jika diperlukan
                // atau parameter lain dari dokumentasi, misalnya:
                // "model": "uberduck_v2"
            })
        });

        // Debugging: Log status response sebelum cek response.ok
        console.log("Uberduck text-to-speech API Response Status:", response.status, response.statusText);

        if (!response.ok) {
            // Jika ada error di response (bukan 200 OK)
            const errorData = await response.json().catch(() => ({ message: "Tidak dapat mem-parse respons error sebagai JSON." }));
            // Debugging: Log error data dari API
            console.error("Uberduck text-to-speech API Error Data (response not OK):", errorData);
            if (response.status === 401) {
                throw new Error(`Unauthorized: API Key Anda mungkin tidak valid atau tidak memiliki izin. (${JSON.stringify(errorData)})`);
            }
            if (response.status === 400 && errorData.detail && errorData.detail.includes("exceeds the maximum character limit")) {
                throw new Error(`Teks terlalu panjang. Batas maksimal teks mungkin telah terlampaui.`);
            }
            throw new Error(`Uberduck API error: ${response.status} - ${JSON_stringify(errorData)}`);
        }

        const data = await response.json();
        // Debugging: Log data yang diterima dari API sebelum cek UUID
        console.log("Uberduck text-to-speech API Success Data:", data);

        if (data.uuid) { // Baris 193
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
            // Debugging: Log kenapa UUID tidak ditemukan
            console.error("UUID tidak ditemukan di respons Uberduck:", data);
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