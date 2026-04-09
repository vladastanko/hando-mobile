import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useLanguage } from '../i18n';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing, fontSize, shadow } from '../theme';
import { Avatar } from '../components/ui/Avatar';

interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  job_id: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  other_user?: { id: string; full_name: string; avatar_url?: string };
  job?: { title: string };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAppContext();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const convoChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        participant_a_profile:profiles!conversations_participant_a_fkey(id, full_name, avatar_url),
        participant_b_profile:profiles!conversations_participant_b_fkey(id, full_name, avatar_url),
        job:jobs(title)
      `)
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (!error && data) {
      const convos: Conversation[] = (data as Record<string, unknown>[]).map((c) => {
        const isA = c.participant_a === user.id;
        const otherProfile = isA
          ? (c.participant_b_profile as { id: string; full_name: string; avatar_url?: string } | null)
          : (c.participant_a_profile as { id: string; full_name: string; avatar_url?: string } | null);
        return {
          id: c.id as string,
          participant_a: c.participant_a as string,
          participant_b: c.participant_b as string,
          job_id: c.job_id as string,
          last_message: c.last_message as string | undefined,
          last_message_at: c.last_message_at as string | undefined,
          other_user: otherProfile ?? undefined,
          job: c.job as { title: string } | undefined,
        };
      });
      setConversations(convos);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();

    // Real-time: conversations list updates
    if (user) {
      convoChannelRef.current = supabase
        .channel(`inbox:${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
          loadConversations();
        })
        .subscribe();
    }

    return () => {
      convoChannelRef.current?.unsubscribe();
    };
  }, [loadConversations]);

  const loadMessages = useCallback(async (convoId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data as Message[]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, []);

  const openConversation = (convo: Conversation) => {
    setActiveConvo(convo);
    setMessages([]);
    loadMessages(convo.id);

    // Subscribe to new messages
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`messages:${convo.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convo.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();
  };

  const closeConversation = () => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setActiveConvo(null);
    setMessages([]);
    setMsgText('');
    loadConversations();
  };

  const sendMessage = async () => {
    if (!user || !activeConvo || !msgText.trim()) return;
    setSending(true);
    const content = msgText.trim();
    setMsgText('');

    const { error } = await supabase.from('messages').insert({
      conversation_id: activeConvo.id,
      sender_id: user.id,
      content,
    });

    if (!error) {
      // Update last_message on conversation
      await supabase
        .from('conversations')
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq('id', activeConvo.id)
        .catch(() => {});
    }
    setSending(false);
  };

  if (activeConvo) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.root, { paddingTop: insets.top }]}>
          {/* Chat header */}
          <View style={styles.chatHeader}>
            <Pressable onPress={closeConversation} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.tx} />
            </Pressable>
            <Avatar url={activeConvo.other_user?.avatar_url} name={activeConvo.other_user?.full_name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chatName} numberOfLines={1}>{activeConvo.other_user?.full_name ?? 'User'}</Text>
              {activeConvo.job && (
                <Text style={styles.chatJob} numberOfLines={1}>{activeConvo.job.title}</Text>
              )}
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.chatEmptyWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.tx3} />
                <Text style={styles.chatEmptyTxt}>{t('startConvo')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.sender_id === user?.id;
              return (
                <View style={[styles.msgBubbleWrap, isMe ? styles.msgBubbleRight : styles.msgBubbleLeft]}>
                  <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                    <Text style={[styles.msgBubbleTxt, isMe && styles.msgBubbleTxtMe]}>{item.content}</Text>
                    <Text style={[styles.msgTime, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Input */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing[2] }]}>
            <TextInput
              style={styles.msgInput}
              placeholder={t('typeMessage')}
              placeholderTextColor={colors.tx3}
              value={msgText}
              onChangeText={setMsgText}
              multiline
              maxLength={1000}
            />
            <Pressable
              style={[styles.sendBtn, (!msgText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!msgText.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Ionicons name="send" size={18} color={colors.white} />
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('navInbox')}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubble-outline" size={48} color={colors.tx3} />
              <Text style={styles.emptyTitle}>{t('noMessages')}</Text>
              <Text style={styles.emptySub}>Accept a job application to start a conversation.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.convoCard} onPress={() => openConversation(item)}>
              <Avatar url={item.other_user?.avatar_url} name={item.other_user?.full_name} size={48} />
              <View style={styles.convoInfo}>
                <View style={styles.convoTopRow}>
                  <Text style={styles.convoName} numberOfLines={1}>{item.other_user?.full_name ?? 'User'}</Text>
                  {item.last_message_at && (
                    <Text style={styles.convoTime}>{formatTime(item.last_message_at)}</Text>
                  )}
                </View>
                {item.job && (
                  <Text style={styles.convoJob} numberOfLines={1}>{item.job.title}</Text>
                )}
                {item.last_message && (
                  <Text style={styles.convoLast} numberOfLines={1}>{item.last_message}</Text>
                )}
              </View>
              <Ionicons name="chevron-right" size={16} color={colors.tx3} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing[4], gap: spacing[3] },
  emptyWrap: { alignItems: 'center', padding: spacing[8], gap: spacing[3] },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.tx },
  emptySub: { fontSize: fontSize.sm, color: colors.tx2, textAlign: 'center' },
  convoCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  convoInfo: { flex: 1, gap: 2 },
  convoTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx, flex: 1 },
  convoTime: { fontSize: fontSize.xs, color: colors.tx3, marginLeft: spacing[2] },
  convoJob: { fontSize: fontSize.xs, color: colors.brand, fontWeight: '600' },
  convoLast: { fontSize: fontSize.sm, color: colors.tx2 },
  // Chat view
  chatHeader: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  backBtn: { padding: 4 },
  chatName: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  chatJob: { fontSize: fontSize.xs, color: colors.brand, fontWeight: '500' },
  messagesContent: { padding: spacing[4], gap: spacing[2], flexGrow: 1 },
  chatEmptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[8] },
  chatEmptyTxt: { fontSize: fontSize.sm, color: colors.tx2, textAlign: 'center' },
  msgBubbleWrap: { marginBottom: spacing[1] },
  msgBubbleLeft: { alignItems: 'flex-start' },
  msgBubbleRight: { alignItems: 'flex-end' },
  msgBubble: {
    maxWidth: '78%',
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: 2,
  },
  msgBubbleMe: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: colors.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  msgBubbleTxt: { fontSize: fontSize.base, color: colors.tx, lineHeight: 20 },
  msgBubbleTxtMe: { color: colors.white },
  msgTime: { fontSize: 10, color: colors.tx3, alignSelf: 'flex-end' },
  inputBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  msgInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.tx,
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
