import { useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';

import { Button, ModalScreen } from '@/ui/controls';
import { radius, space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** Native app: restoring means pasting back the text that 備份學習紀錄 shared (there is no file picker). */
export function BackupPaste({ visible, onClose, onRestore }: { visible: boolean; onClose: () => void; onRestore: (text: string) => void }) {
  const c = useColors();
  const [text, setText] = useState('');
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ModalScreen>
        <View style={styles.body}>
          <Txt variant="title">從備份還原</Txt>
          <Txt color="textMuted">把「備份學習紀錄」存下來的內容整段貼到下面。</Txt>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="貼上備份內容"
            placeholderTextColor={c.textFaint}
            style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          />
          <View style={styles.buttons}>
            <Button variant="secondary" label="取消" onPress={onClose} style={{ flex: 1 }} />
            <Button label="還原" onPress={() => onRestore(text)} disabled={!text.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </ModalScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: space.lg, gap: space.md },
  input: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: space.md, textAlignVertical: 'top', fontSize: 13 },
  buttons: { flexDirection: 'row', gap: space.md },
});
