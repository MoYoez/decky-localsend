import { 
  Focusable, 
  DialogHeader, 
  DialogBody, 
  DialogFooter, 
  DialogButton,
  DialogButtonPrimary,
  ModalRoot
} from "@decky/ui";
import { toaster } from "@decky/api";
import { copyToClipboard } from "../utils/copyClipBoard";

interface TextReceivedModalProps {
  title: string;
  content: string;
  fileName: string;
  onClose: () => void;
  closeModal?: () => void;
}

/**
 * Modal component for displaying received text content
 * Shows text with preview and copy option
 */
export const TextReceivedModal = ({ 
  title, 
  content, 
  fileName,
  onClose,
  closeModal
}: TextReceivedModalProps) => {
  
  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(content);
    
    if (success) {
      toaster.toast({
        title: "Copied",
        body: "Text copied to clipboard successfully",
      });
      closeModal?.();
      onClose();
    } else {
      toaster.toast({
        title: "Copy Failed",
        body: "Failed to copy text to clipboard",
      });
    }
  };

  const handleClose = () => {
    closeModal?.();
    onClose();
  };

  return (
    <ModalRoot onCancel={handleClose} closeModal={closeModal}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <Focusable style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
          {/* File info */}
          <div style={{ 
            marginBottom: '10px', 
            paddingBottom: '10px',
            borderBottom: '1px solid #3d3d3d'
          }}>
            <div style={{ 
              color: '#b8b6b4', 
              fontSize: '12px', 
              marginBottom: '5px' 
            }}>
              <strong>File Name:</strong> {fileName}
            </div>
            <div style={{ 
              color: '#b8b6b4', 
              fontSize: '12px' 
            }}>
              <strong>Content Length:</strong> {content.length} characters
            </div>
          </div>

          {/* Content preview */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ 
              color: '#b8b6b4', 
              fontSize: '12px', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Text Content:
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: '#0e0e0e',
              border: '1px solid #3d3d3d',
              borderRadius: '4px',
              maxHeight: '250px',
              overflowY: 'auto',
              fontSize: '13px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.5',
              color: '#e8e8e8',
            }}>
              {content}
            </div>
          </div>

          {/* Hint text */}
          <div style={{
            padding: '8px',
            backgroundColor: '#1a2332',
            border: '1px solid #2a4a6a',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#8ab4f8',
            textAlign: 'center',
          }}>
            Click "Copy to Clipboard" to copy the text content
          </div>
        </Focusable>
      </DialogBody>
      <DialogFooter>
        <DialogButton onClick={handleClose}>
          Close
        </DialogButton>
        <DialogButtonPrimary onClick={handleCopyToClipboard}>
          Copy to Clipboard
        </DialogButtonPrimary>
      </DialogFooter>
    </ModalRoot>
  );
};
