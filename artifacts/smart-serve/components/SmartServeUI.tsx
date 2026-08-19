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

type IconName = React.ComponentProps<typeof Feather>['name'];

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
    {
      backgroundColor: colors.background,
      paddingTop: insets.top + 10,
      paddingBottom: insets.bottom + 100,
    },
    style,
  ];

  if (!scroll) {
    return <View style={contentStyle}>{children}</View>;
  }

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

/* ---------------------------------------------------------
   ICON BUTTON
--------------------------------------------------------- */

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'soft',
  size = 44,
}: {
  icon: IconName;
  onPress?: () => void;
  label?: string;
  tone?: 'soft' | 'primary' | 'danger';
  size?: number;
}) {
  const colors = useColors();

  const backgroundColor =
    tone === 'primary'
      ? colors.primary
      : tone === 'danger'
        ? colors.destructive
        : colors.secondary;

  const iconColor =
    tone === 'soft'
      ? colors.foreground
      : colors.primaryForeground;

  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          borderColor:
            tone === 'soft'
              ? colors.border
              : 'transparent',
          opacity: pressed ? 0.72 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={iconColor}
      />
    </Pressable>
  );
}

/* ---------------------------------------------------------
   PRIMARY BUTTON
--------------------------------------------------------- */

export function PrimaryButton({
  children,
  onPress,
  icon,
  secondary = false,
  danger = false,
  outline = false,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  icon?: IconName;
  secondary?: boolean;
  danger?: boolean;
  outline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();

  let backgroundColor = colors.primary;
  let textColor = colors.primaryForeground;
  let borderColor = 'transparent';

  if (danger) {
    backgroundColor = colors.destructive;
    textColor = colors.destructiveForeground;
  }

  if (secondary) {
    backgroundColor = colors.secondary;
    textColor = colors.secondaryForeground;
  }

  if (outline) {
    backgroundColor = 'transparent';
    textColor = colors.primary;
    borderColor = colors.primary;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor,
          borderColor,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={18}
          color={textColor}
        />
      ) : null}

      <Text
        style={[
          styles.primaryButtonText,
          { color: textColor },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------
   SECTION HEADING
--------------------------------------------------------- */

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
      <Text
        style={[
          styles.sectionTitle,
          { color: colors.foreground },
        ]}
      >
        {title}
      </Text>

      {action ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
        >
          <Text
            style={[
              styles.sectionAction,
              { color: colors.primary },
            ]}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------
   SEARCH FIELD
--------------------------------------------------------- */

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
}: Pick<
  TextInputProps,
  'value' |
  'onChangeText' |
  'placeholder' |
  'onSubmitEditing'
>) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.searchField,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.searchIcon,
          { backgroundColor: colors.secondary },
        ]}
      >
        <Feather
          name="search"
          size={18}
          color={colors.primary}
        />
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.searchInput,
          { color: colors.foreground },
        ]}
        returnKeyType="search"
      />

      <View
        style={[
          styles.filterButton,
          { backgroundColor: colors.secondary },
        ]}
      >
        <Feather
          name="sliders"
          size={17}
          color={colors.foreground}
        />
      </View>
    </View>
  );
}

/* ---------------------------------------------------------
   PROVIDER CARD
--------------------------------------------------------- */

export function ProviderCard({
  provider,
  onPress,
}: {
  provider: Provider;
  onPress?: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [
            {
              scale: pressed ? 0.985 : 1,
            },
          ],
        },
      ]}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          { backgroundColor: colors.secondary },
        ]}
      >
        <Text
          style={[
            styles.avatarText,
            { color: colors.primary },
          ]}
        >
          {provider.initials}
        </Text>

        {provider.verified ? (
          <View
            style={[
              styles.verifiedBadge,
              { backgroundColor: colors.primary },
            ]}
          >
            <Feather
              name="check"
              size={9}
              color={colors.primaryForeground}
            />
          </View>
        ) : null}
      </View>

      {/* Details */}
      <View style={styles.providerDetails}>
        <View style={styles.providerNameRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.providerName,
              { color: colors.foreground },
            ]}
          >
            {provider.name}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.providerService,
            { color: colors.mutedForeground },
          ]}
        >
          {provider.service}
        </Text>

        <View style={styles.providerMetaRow}>
          <View style={styles.metaItem}>
            <Feather
              name="shield"
              size={11}
              color={colors.primary}
            />

            <Text
              style={[
                styles.trustText,
                { color: colors.primary },
              ]}
            >
              {provider.trustScore}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Feather
              name="map-pin"
              size={11}
              color={colors.mutedForeground}
            />

            <Text
              style={[
                styles.metaText,
                { color: colors.mutedForeground },
              ]}
            >
              {provider.distance}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Feather
              name="clock"
              size={11}
              color={colors.mutedForeground}
            />

            <Text
              style={[
                styles.metaText,
                { color: colors.mutedForeground },
              ]}
            >
              {provider.eta}
            </Text>
          </View>
        </View>
      </View>

      {/* Price */}
      <View style={styles.providerPrice}>
        <Text
          style={[
            styles.priceText,
            { color: colors.foreground },
          ]}
        >
          {provider.price}
        </Text>

        <View style={styles.ratingRow}>
          <Feather
            name="star"
            size={12}
            color={colors.warning}
          />

          <Text
            style={[
              styles.ratingText,
              { color: colors.mutedForeground },
            ]}
          >
            {provider.rating}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------
   TAG
--------------------------------------------------------- */

export function Tag({
  children,
  tone = 'soft',
  icon,
}: {
  children: React.ReactNode;
  tone?: 'soft' | 'gold' | 'green' | 'danger' | 'blue';
  icon?: IconName;
}) {
  const colors = useColors();

  let backgroundColor = colors.secondary;
  let textColor = colors.foreground;

  if (tone === 'gold') {
    backgroundColor = 'rgba(247,201,91,0.16)';
    textColor = colors.warning;
  }

  if (tone === 'green') {
    backgroundColor = 'rgba(53,212,154,0.14)';
    textColor = colors.success;
  }

  if (tone === 'danger') {
    backgroundColor = 'rgba(255,95,103,0.14)';
    textColor = colors.destructive;
  }

  if (tone === 'blue') {
    backgroundColor = 'rgba(101,169,255,0.14)';
    textColor = colors.info;
  }

  return (
    <View
      style={[
        styles.tag,
        { backgroundColor },
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={11}
          color={textColor}
        />
      ) : null}

      <Text
        style={[
          styles.tagText,
          { color: textColor },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/* ---------------------------------------------------------
   MODERN ACTION CARD
--------------------------------------------------------- */

export function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
  tone = 'primary',
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress?: () => void;
  tone?: 'primary' | 'accent' | 'blue';
}) {
  const colors = useColors();

  const backgroundColor =
    tone === 'accent'
      ? colors.accent
      : tone === 'blue'
        ? '#315B9A'
        : colors.primary;

  const foreground =
    tone === 'accent'
      ? colors.accentForeground
      : '#061A18';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        {
          backgroundColor,
          opacity: pressed ? 0.9 : 1,
          transform: [
            {
              scale: pressed ? 0.975 : 1,
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.actionIcon,
          {
            backgroundColor:
              'rgba(255,255,255,0.20)',
          },
        ]}
      >
        <Feather
          name={icon}
          size={25}
          color={foreground}
        />
      </View>

      <View style={styles.actionArrow}>
        <Feather
          name="arrow-up-right"
          size={18}
          color={foreground}
        />
      </View>

      <View style={styles.actionContent}>
        <Text
          style={[
            styles.actionTitle,
            { color: foreground },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.actionSubtitle,
            { color: foreground },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------
   SERVICE TILE
--------------------------------------------------------- */

export function ServiceTile({
  title,
  icon,
  onPress,
  accent = false,
}: {
  title: string;
  icon: IconName;
  onPress?: () => void;
  accent?: boolean;
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.serviceTile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
          transform: [
            {
              scale: pressed ? 0.97 : 1,
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.serviceIcon,
          {
            backgroundColor: accent
              ? 'rgba(255,139,103,0.15)'
              : 'rgba(32,199,183,0.12)',
          },
        ]}
      >
        <Feather
          name={icon}
          size={22}
          color={
            accent
              ? colors.accent
              : colors.primary
          }
        />
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.serviceTitle,
          { color: colors.foreground },
        ]}
      >
        {title}
      </Text>

      <Feather
        name="arrow-up-right"
        size={14}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

/* ---------------------------------------------------------
   STAT CARD
--------------------------------------------------------- */

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.statIcon,
          { backgroundColor: colors.secondary },
        ]}
      >
        <Feather
          name={icon}
          size={17}
          color={colors.primary}
        />
      </View>

      <Text
        style={[
          styles.statValue,
          { color: colors.foreground },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.statLabel,
          { color: colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/* ---------------------------------------------------------
   STYLES
--------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: 18,
    gap: 18,
  },

  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: 17,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
  },

  primaryButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: -0.1,
  },

  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },

  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.5,
  },

  sectionAction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },

  searchField: {
    height: 58,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },

  searchIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },

  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  providerCard: {
    minHeight: 108,
    borderRadius: 21,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },

  verifiedBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111D30',
  },

  providerDetails: {
    flex: 1,
    gap: 5,
  },

  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  providerName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },

  providerService: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },

  providerMetaRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    marginTop: 2,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  trustText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },

  metaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },

  providerPrice: {
    alignItems: 'flex-end',
    gap: 7,
  },

  priceText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  ratingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },

  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  tagText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },

  actionCard: {
    minHeight: 172,
    flex: 1,
    borderRadius: 24,
    padding: 17,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },

  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionArrow: {
    position: 'absolute',
    top: 18,
    right: 17,
  },

  actionContent: {
    gap: 5,
  },

  actionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    letterSpacing: -0.3,
  },

  actionSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    opacity: 0.72,
  },

  serviceTile: {
    width: 145,
    minHeight: 128,
    borderRadius: 21,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
  },

  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  serviceTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },

  statCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    gap: 5,
  },

  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },

  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
  },

  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
});