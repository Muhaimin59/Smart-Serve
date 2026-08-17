import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import type { Provider } from '@/context/AppContext';

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const contentStyle = [
    styles.screen,
    { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 },
    style,
  ];
  if (!scroll) return <View style={contentStyle}>{children}</View>;
  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'soft',
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  label?: string;
  tone?: 'soft' | 'primary' | 'danger';
}) {
  const colors = useColors();
  const backgroundColor =
    tone === 'primary' ? colors.primary : tone === 'danger' ? colors.destructive : colors.secondary;
  const iconColor = tone === 'soft' ? colors.foreground : colors.primaryForeground;
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor, opacity: pressed ? 0.72 : 1 }]}
    >
      <Feather name={icon} size={19} color={iconColor} />
    </Pressable>
  );
}

export function PrimaryButton({
  children,
  onPress,
  icon,
  secondary = false,
  danger = false,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  secondary?: boolean;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const backgroundColor = danger ? colors.destructive : secondary ? colors.secondary : colors.primary;
  const textColor = secondary ? colors.secondaryForeground : colors.primaryForeground;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor, opacity: pressed ? 0.78 : 1 },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={17} color={textColor} /> : null}
      <Text style={[styles.primaryButtonText, { color: textColor }]}>{children}</Text>
    </Pressable>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
}: Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'onSubmitEditing'>) {
  const colors = useColors();
  return (
    <View style={[styles.searchField, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={19} color={colors.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.searchInput, { color: colors.foreground }]}
        returnKeyType="search"
      />
      <Feather name="sliders" size={18} color={colors.mutedForeground} />
    </View>
  );
}

export function ProviderCard({ provider, onPress }: { provider: Provider; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{provider.initials}</Text>
      </View>
      <View style={styles.providerDetails}>
        <View style={styles.providerNameRow}>
          <Text style={[styles.providerName, { color: colors.foreground }]}>{provider.name}</Text>
          {provider.verified ? <Feather name="check-circle" size={15} color={colors.primary} /> : null}
        </View>
        <Text style={[styles.providerService, { color: colors.mutedForeground }]}>{provider.service}</Text>
        <View style={styles.providerMetaRow}>
          <Text style={[styles.trustText, { color: colors.primary }]}>Trust {provider.trustScore}</Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{provider.distance}</Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{provider.eta}</Text>
        </View>
      </View>
      <View style={styles.providerPrice}>
        <Text style={[styles.priceText, { color: colors.foreground }]}>{provider.price}</Text>
        <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>★ {provider.rating}</Text>
      </View>
    </Pressable>
  );
}

export function Tag({ children, tone = 'soft' }: { children: React.ReactNode; tone?: 'soft' | 'gold' | 'green' }) {
  const colors = useColors();
  const backgroundColor = tone === 'gold' ? colors.accent : tone === 'green' ? colors.secondary : colors.muted;
  return (
    <View style={[styles.tag, { backgroundColor }]}>
      <Text style={[styles.tagText, { color: colors.foreground }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 18,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  sectionAction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  searchField: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 11,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  providerCard: {
    minHeight: 102,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  providerDetails: {
    flex: 1,
    gap: 4,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  providerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  providerService: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  providerMetaRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  trustText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  metaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  providerPrice: {
    alignItems: 'flex-end',
    gap: 6,
  },
  priceText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  ratingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
});