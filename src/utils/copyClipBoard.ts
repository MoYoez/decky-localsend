// refer to https://github.com/xXJSONDeruloXx/decky-lsfg-vk/blob/97a70cd68813f2174fe145ee79784e509d11a742/src/utils/clipboardUtils.ts#L43

export async function copyToClipboard(text: string): Promise<boolean> {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    
    try {
      tempInput.focus();
      tempInput.select();
      
      let copySuccess = false;
      try {
        if (document.execCommand('copy')) {
          copySuccess = true;
        }
      } catch (e) {
        try {
          await navigator.clipboard.writeText(text);
          copySuccess = true;
        } catch (clipboardError) {
          console.error('Both copy methods failed:', e, clipboardError);
        }
      }
      
      return copySuccess;
    } finally {
      document.body.removeChild(tempInput);
    }
}