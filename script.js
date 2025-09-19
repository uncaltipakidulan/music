// ... (bagian atas script.js) ...

async function loadVoices() {
    showStatus('Memuat daftar suara...', 'info');
    voiceSelect.innerHTML = '<option value="">Memuat suara...</option>';
    voiceSelect.disabled = true;
    generateButton.disabled = true;

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
            if (response.status === 401) {
                throw new Error(`Unauthorized: API Key Anda mungkin tidak valid atau tidak memiliki izin. (${errorData.detail || 'Periksa API Key'})`);
            }
            throw new Error(`Gagal memuat suara: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const apiResponse = await response.json();
        console.log("Uberduck voices API response:", apiResponse);

        const allVoices = apiResponse.voices;
        if (!Array.isArray(allVoices)) {
            throw new TypeError("Properti 'voices' dalam respons API Uberduck bukan array seperti yang diharapkan.");
        }

        console.log("Jumlah total suara dari API:", allVoices.length);
        console.log("Detail semua suara dari API (periksa properti 'category' dan 'display_name'):", allVoices); // <<< TAMBAHKAN INI

        const ttsVoices = allVoices.filter(v =>
            v.category === 'tts' || v.category === 'voice_conversion' || v.category === 'singing'
        );

        console.log("Jumlah suara setelah filter (tts/voice_conversion/singing):", ttsVoices.length);

        voiceSelect.innerHTML = '<option value="">-- Pilih Suara --</option>';

        if (ttsVoices.length === 0) {
            // Ini akan dieksekusi jika filter menghasilkan 0 suara
            voiceSelect.innerHTML += '<option value="">Tidak ada suara kategori yang tersedia</option>';
            throw new Error('Tidak ada suara kategori TTS/Voice Conversion/Singing yang ditemukan dengan API Key ini.');
        }

        ttsVoices.sort((a, b) => a.display_name.localeCompare(b.display_name));
        ttsVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.display_name} (${voice.category})`;
            voiceSelect.appendChild(option);
            // console.log("Menambahkan opsi suara:", option.textContent); // Anda bisa mengaktifkan ini jika ingin melihat setiap opsi
        });
        
        voiceSelect.disabled = false;
        generateButton.disabled = false;
        hideStatus();

    } catch (error) {
        console.error('Error loading voices:', error);
        showStatus(`Gagal memuat suara: ${error.message}. Pastikan API Key benar & jaringan tersedia.`, 'error');
        voiceSelect.innerHTML = '<option value="">Gagal memuat suara</option>';
        voiceSelect.disabled = true;
        generateButton.disabled = true;
    }
}
// ... (sisa script.js tidak berubah) ...
