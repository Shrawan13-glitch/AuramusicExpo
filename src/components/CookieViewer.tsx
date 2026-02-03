import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  useTheme, 
  Chip,
  IconButton,
  Divider
} from 'react-native-paper';
import { AuthCookie, CookieManager } from '../utils/cookieManager';
import { Clipboard } from 'react-native';

interface CookieViewerProps {
  cookies: AuthCookie[];
  onClose: () => void;
}

const CookieViewer = React.memo(({ cookies, onClose }: CookieViewerProps) => {
  const theme = useTheme();
  const [expandedCookie, setExpandedCookie] = useState<string | null>(null);

  const handleCopyCookie = useCallback(async (cookie: AuthCookie) => {
    const cookieString = `${cookie.name}=${cookie.value}`;
    Clipboard.setString(cookieString);
    Alert.alert('Copied', `Cookie "${cookie.name}" copied to clipboard`);
  }, []);

  const handleCopyAllCookies = useCallback(async () => {
    const cookieString = CookieManager.formatCookiesForRequest(cookies);
    Clipboard.setString(cookieString);
    Alert.alert('Copied', 'All cookies copied to clipboard');
  }, [cookies]);

  const toggleExpanded = useCallback((cookieName: string) => {
    setExpandedCookie(expandedCookie === cookieName ? null : cookieName);
  }, [expandedCookie]);

  const importantCookies = cookies.filter(cookie => 
    cookie.name.includes('SID') || 
    cookie.name.includes('SAPISID') ||
    cookie.name.includes('APISID') ||
    cookie.name.includes('LOGIN_INFO') ||
    cookie.name.startsWith('__Secure')
  );

  const otherCookies = cookies.filter(cookie => !importantCookies.includes(cookie));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Authentication Cookies
        </Text>
        <IconButton icon="close" onPress={onClose} />
      </View>

      <View style={styles.stats}>
        <Chip icon="cookie" style={styles.statChip}>
          Total: {cookies.length}
        </Chip>
        <Chip icon="shield-check" style={styles.statChip}>
          Auth: {importantCookies.length}
        </Chip>
      </View>

      <View style={styles.actions}>
        <Button 
          mode="contained" 
          onPress={handleCopyAllCookies}
          style={styles.actionButton}
        >
          Copy All Cookies
        </Button>
      </View>

      <ScrollView style={styles.cookieList} showsVerticalScrollIndicator={false}>
        {importantCookies.length > 0 && (
          <>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
              Authentication Cookies
            </Text>
            {importantCookies.map((cookie, index) => (
              <Card key={`auth-${index}`} style={styles.cookieCard}>
                <Card.Content>
                  <View style={styles.cookieHeader}>
                    <View style={styles.cookieInfo}>
                      <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                        {cookie.name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {cookie.domain}
                      </Text>
                    </View>
                    <View style={styles.cookieActions}>
                      <IconButton 
                        icon="content-copy" 
                        size={20}
                        onPress={() => handleCopyCookie(cookie)}
                      />
                      <IconButton 
                        icon={expandedCookie === cookie.name ? "chevron-up" : "chevron-down"}
                        size={20}
                        onPress={() => toggleExpanded(cookie.name)}
                      />
                    </View>
                  </View>
                  
                  {expandedCookie === cookie.name && (
                    <View style={styles.cookieDetails}>
                      <Divider style={{ marginVertical: 8 }} />
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        Value:
                      </Text>
                      <Text 
                        variant="bodySmall" 
                        style={[styles.cookieValue, { color: theme.colors.onSurface }]}
                        selectable
                      >
                        {cookie.value}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                        Path: {cookie.path}
                      </Text>
                      {cookie.expires && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          Expires: {cookie.expires}
                        </Text>
                      )}
                    </View>
                  )}
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        {otherCookies.length > 0 && (
          <>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
              Other Cookies ({otherCookies.length})
            </Text>
            {otherCookies.slice(0, 10).map((cookie, index) => (
              <Card key={`other-${index}`} style={styles.cookieCard}>
                <Card.Content>
                  <View style={styles.cookieHeader}>
                    <View style={styles.cookieInfo}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                        {cookie.name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {cookie.value.substring(0, 50)}{cookie.value.length > 50 ? '...' : ''}
                      </Text>
                    </View>
                    <IconButton 
                      icon="content-copy" 
                      size={20}
                      onPress={() => handleCopyCookie(cookie)}
                    />
                  </View>
                </Card.Content>
              </Card>
            ))}
            {otherCookies.length > 10 && (
              <Text variant="bodySmall" style={[styles.moreText, { color: theme.colors.onSurfaceVariant }]}>
                ... and {otherCookies.length - 10} more cookies
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
});

export default CookieViewer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
  },
  actions: {
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 8,
  },
  cookieList: {
    flex: 1,
  },
  sectionTitle: {
    marginVertical: 12,
    fontWeight: '600',
  },
  cookieCard: {
    marginBottom: 8,
  },
  cookieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cookieInfo: {
    flex: 1,
  },
  cookieActions: {
    flexDirection: 'row',
  },
  cookieDetails: {
    marginTop: 8,
  },
  cookieValue: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  moreText: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});